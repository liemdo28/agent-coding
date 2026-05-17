// collectors/GPUMonitor.js - GPU monitoring with graceful fallback (no hard NVIDIA dep)
// macOS: system_profiler SPDisplaysDataType -json
// Windows: wmic path Win32_VideoController
// Linux: nvidia-smi (optional), graceful null if absent
// All paths must return null gracefully when GPU info is unavailable.
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const EXEC_TIMEOUT_MS = 4000;

export class GPUMonitor {
  constructor() {
    this._platform    = process.platform;
    this._available   = null;   // null = unchecked, true/false after probe()
    this._lastReading = null;
  }

  // Run once at startup to detect whether GPU info is available.
  async probe() {
    try {
      const reading     = await this._readGPU();
      this._available   = reading !== null;
      this._lastReading = reading;
      return this._available;
    } catch {
      this._available = false;
      return false;
    }
  }

  // Read current GPU state. Returns null when unavailable — never throws.
  async read() {
    if (this._available === false) return null;
    try {
      const reading     = await this._readGPU();
      this._lastReading = reading;
      return reading;
    } catch {
      this._available = false;
      return null;
    }
  }

  async _readGPU() {
    switch (this._platform) {
      case 'darwin': return this._readMacOS();
      case 'win32':  return this._readWindows();
      case 'linux':  return this._readLinux();
      default:       return null;
    }
  }

  async _readMacOS() {
    try {
      const { stdout } = await execAsync(
        'system_profiler SPDisplaysDataType -json 2>/dev/null',
        { timeout: EXEC_TIMEOUT_MS }
      );
      const data    = JSON.parse(stdout);
      const display = data?.SPDisplaysDataType?.[0];
      if (!display) return null;

      const vramStr = display.spdisplays_vram ?? display.spdisplays_vram_shared ?? null;
      return {
        name:              display.spdisplays_vendor ?? display._name ?? 'Unknown GPU',
        vram_mb:           vramStr ? _parseVRAM(vramStr) : null,
        utilization_pct:   null,    // macOS doesn't expose GPU utilization without private APIs
        platform:          'darwin',
      };
    } catch {
      return null;
    }
  }

  async _readWindows() {
    try {
      const { stdout } = await execAsync(
        'wmic path Win32_VideoController get Name,AdapterRAM /format:csv 2>NUL',
        { timeout: EXEC_TIMEOUT_MS }
      );
      const lines = stdout.split('\n').filter((l) => l.trim() && !l.startsWith('Node'));
      if (!lines.length) return null;

      const parts      = lines[0].split(',');
      const adapterRam = parseInt(parts[1], 10);
      const name       = (parts[2] ?? '').trim() || 'Unknown GPU';
      return {
        name,
        vram_mb:         isNaN(adapterRam) ? null : Math.round(adapterRam / 1048576),
        utilization_pct: null,
        platform:        'win32',
      };
    } catch {
      return null;
    }
  }

  async _readLinux() {
    try {
      // nvidia-smi is optional — fall back gracefully if absent
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits 2>/dev/null',
        { timeout: EXEC_TIMEOUT_MS }
      );
      const parts = stdout.trim().split(',').map((s) => s.trim());
      if (parts.length < 3) return null;
      return {
        name:            parts[0],
        vram_mb:         parseInt(parts[1], 10) || null,
        vram_total_mb:   parseInt(parts[2], 10) || null,
        utilization_pct: parseInt(parts[3], 10) || null,
        platform:        'linux',
      };
    } catch {
      return null;
    }
  }

  get isAvailable()  { return this._available === true; }
  get lastReading()  { return this._lastReading; }
}

function _parseVRAM(str) {
  const m = String(str).match(/(\d+)\s*(MB|GB)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return m[2].toUpperCase() === 'GB' ? n * 1024 : n;
}
