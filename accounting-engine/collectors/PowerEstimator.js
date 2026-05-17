// collectors/PowerEstimator.js - Estimate power draw from CPU/GPU utilization
// No hardware sensors required — uses platform heuristics and TDP assumptions.
// Values are best-effort estimates for audit/accounting, not precision measurements.

// CO2 intensity: ~0.233 kg CO2eq / kWh (global average 2024, IEA)
const CO2_KG_PER_KWH = 0.233;

// Default TDP assumptions — can be overridden via constructor options
const DEFAULT_TDP = {
  darwin: { cpu_w: 15,  gpu_w: 15,  idle_w: 4  },  // Apple Silicon / MacBook heuristic
  win32:  { cpu_w: 65,  gpu_w: 100, idle_w: 8  },  // mid-range desktop/gaming laptop
  linux:  { cpu_w: 65,  gpu_w: 100, idle_w: 8  },
  default:{ cpu_w: 45,  gpu_w: 50,  idle_w: 6  },
};

export class PowerEstimator {
  constructor(options = {}) {
    const platform = process.platform;
    const tdp      = DEFAULT_TDP[platform] ?? DEFAULT_TDP.default;

    this._cpuTdpW = options.cpuTdpW ?? tdp.cpu_w;
    this._gpuTdpW = options.gpuTdpW ?? tdp.gpu_w;
    this._idleW   = options.idleW   ?? tdp.idle_w;
  }

  /**
   * Estimate instantaneous power draw.
   * @param {number}      cpuPct  0–100
   * @param {number|null} gpuPct  0–100, or null when GPU is unavailable
   * @returns {{ cpu_w, gpu_w, total_w, co2_g_per_hour }}
   */
  estimate(cpuPct, gpuPct = null) {
    const cpuW   = this._idleW + (Math.min(cpuPct, 100) / 100) * this._cpuTdpW;
    const gpuW   = gpuPct != null ? (Math.min(gpuPct, 100) / 100) * this._gpuTdpW : 0;
    const totalW = cpuW + gpuW;
    const co2GPerHour = (totalW / 1000) * CO2_KG_PER_KWH * 1000;

    return {
      cpu_w:          _r(cpuW),
      gpu_w:          _r(gpuW),
      total_w:        _r(totalW),
      co2_g_per_hour: _r2(co2GPerHour),
    };
  }

  /**
   * Estimate total energy and cost for a session.
   * @param {number} durationMs   session duration in milliseconds
   * @param {number} avgCpuPct    average CPU utilization 0–100
   * @param {number|null} avgGpuPct   average GPU utilization 0–100, or null
   * @param {number} kwhCostUSD   electricity price per kWh (default $0.12)
   * @returns {{ energy_kwh, cost_usd, cost_cents, co2_g }}
   */
  estimateSessionCost(durationMs, avgCpuPct, avgGpuPct = null, kwhCostUSD = 0.12) {
    const { total_w } = this.estimate(avgCpuPct, avgGpuPct);
    const durationH   = durationMs / 3_600_000;
    const energyKwh   = (total_w / 1000) * durationH;
    const co2G        = energyKwh * CO2_KG_PER_KWH * 1000;

    return {
      energy_kwh: _r4(energyKwh),
      cost_usd:   _r4(energyKwh * kwhCostUSD),
      cost_cents: _r2(energyKwh * kwhCostUSD * 100),
      co2_g:      _r2(co2G),
    };
  }

  get tdp() {
    return { cpu_w: this._cpuTdpW, gpu_w: this._gpuTdpW, idle_w: this._idleW };
  }
}

const _r  = (n) => Math.round(n * 10) / 10;
const _r2 = (n) => Math.round(n * 100) / 100;
const _r4 = (n) => Math.round(n * 10000) / 10000;
