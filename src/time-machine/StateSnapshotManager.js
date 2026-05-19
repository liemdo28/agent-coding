/**
 * StateSnapshotManager - Manages snapshots of engineering state
 * Supports architecture, QA, memory, patch chain, and runtime config snapshots
 */
import BaseEngine from '../shared/BaseEngine.js';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class StateSnapshotManager extends BaseEngine {
  constructor() {
    super('StateSnapshotManager');
    this.snapshotDir = './data/time-machine/snapshots';
    this.snapshotIndex = {};
  }

  async init() {
    await super.init();
    await fs.ensureDir(this.snapshotDir);
    await fs.ensureDir('./logs');
    
    const indexPath = path.join(this.snapshotDir, 'index.json');
    try {
      this.snapshotIndex = await fs.readJson(indexPath);
      this.log(`Loaded ${Object.keys(this.snapshotIndex).length} existing snapshots`);
    } catch {
      this.snapshotIndex = {};
      await this._saveIndex();
    }
    
    this.log('StateSnapshotManager ready');
  }

  async _saveIndex() {
    await fs.writeJson(
      path.join(this.snapshotDir, 'index.json'),
      this.snapshotIndex,
      { spaces: 2 }
    );
  }

  async createSnapshot(label, metadata = {}) {
    const id = `SNAP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    
    const snapshot = {
      id,
      label,
      timestamp,
      metadata,
      state: {
        architecture: await this._captureArchitectureState(),
        qa: await this._captureQAState(),
        memory: await this._captureMemoryState(),
        patchChain: await this._capturePatchChainState(),
        runtimeConfig: await this._captureRuntimeConfigState()
      },
      checksum: null
    };

    snapshot.checksum = this._calculateChecksum(snapshot.state);

    const snapshotPath = path.join(this.snapshotDir, `${id}.json`);
    await fs.writeJson(snapshotPath, snapshot, { spaces: 2 });

    this.snapshotIndex[id] = {
      id,
      label,
      timestamp,
      path: snapshotPath,
      metadata,
      checksum: snapshot.checksum
    };
    await this._saveIndex();

    await this._writeLog(`Created snapshot: ${id} - ${label}`);
    return snapshot;
  }

  async _captureArchitectureState() {
    const archDir = './data/architecture';
    try {
      const files = await fs.readdir(archDir);
      const state = {};
      for (const file of files) {
        if (file.endsWith('.json')) {
          state[file] = await fs.readJson(path.join(archDir, file));
        }
      }
      return { files: Object.keys(state), captured: true, data: state };
    } catch {
      return { files: [], captured: false, data: {} };
    }
  }

  async _captureQAState() {
    const qaDir = './data/qa';
    try {
      const files = await fs.readdir(qaDir);
      const state = {};
      for (const file of files) {
        if (file.endsWith('.json')) {
          state[file] = await fs.readJson(path.join(qaDir, file));
        }
      }
      return { files: Object.keys(state), captured: true, data: state };
    } catch {
      return { files: [], captured: false, data: {} };
    }
  }

  async _captureMemoryState() {
    const memoryDir = './data/memory';
    try {
      const files = await fs.readdir(memoryDir);
      const state = {};
      for (const file of files) {
        if (file.endsWith('.json')) {
          state[file] = await fs.readJson(path.join(memoryDir, file));
        }
      }
      return { files: Object.keys(state), captured: true, data: state };
    } catch {
      return { files: [], captured: false, data: {} };
    }
  }

  async _capturePatchChainState() {
    const patchDir = './data/patches';
    try {
      const chainFile = path.join(patchDir, 'chain.json');
      const chain = await fs.readJson(chainFile);
      return { captured: true, data: chain };
    } catch {
      return { captured: false, data: { patches: [] } };
    }
  }

  async _captureRuntimeConfigState() {
    const configPaths = [
      './data/config.json',
      './data/runtime.json',
      './data/settings.json'
    ];
    const state = {};
    for (const configPath of configPaths) {
      try {
        const filename = path.basename(configPath);
        state[filename] = await fs.readJson(configPath);
      } catch {
        // Config file doesn't exist, skip
      }
    }
    return { captured: true, data: state };
  }

  _calculateChecksum(state) {
    const stateStr = JSON.stringify(state, Object.keys(state).sort());
    return crypto.createHash('sha256').update(stateStr).digest('hex').slice(0, 16);
  }

  async getSnapshot(id) {
    const snapshotPath = path.join(this.snapshotDir, `${id}.json`);
    try {
      const snapshot = await fs.readJson(snapshotPath);
      const calculatedChecksum = this._calculateChecksum(snapshot.state);
      if (calculatedChecksum !== snapshot.checksum) {
        this.warn(`Snapshot ${id} checksum mismatch - data may be corrupted`);
        snapshot.integrityWarning = true;
      }
      return snapshot;
    } catch {
      return null;
    }
  }

  async listSnapshots() {
    return Object.values(this.snapshotIndex).map(s => ({
      id: s.id,
      label: s.label,
      timestamp: s.timestamp,
      metadata: s.metadata
    }));
  }

  async deleteSnapshot(id) {
    const snapshotPath = path.join(this.snapshotDir, `${id}.json`);
    try {
      await fs.remove(snapshotPath);
      delete this.snapshotIndex[id];
      await this._saveIndex();
      await this._writeLog(`Deleted snapshot: ${id}`);
      return true;
    } catch {
      return false;
    }
  }

  async save(data, filename) {
    const filepath = path.join(this.snapshotDir, filename);
    await fs.writeJson(filepath, data, { spaces: 2 });
    return filepath;
  }

  async load(filename) {
    const filepath = path.join(this.snapshotDir, filename);
    try {
      return await fs.readJson(filepath);
    } catch {
      return null;
    }
  }

  async _writeLog(message) {
    const timestamp = new Date().toISOString();
    await fs.appendFile(
      './logs/time-machine.log',
      `[${timestamp}] [StateSnapshotManager] ${message}\n`
    );
  }
}

export default StateSnapshotManager;
