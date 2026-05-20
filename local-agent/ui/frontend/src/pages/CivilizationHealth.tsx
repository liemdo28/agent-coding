// pages/CivilizationHealth.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface Sector {
  name: string;
  status: string;
  nodes: number;
  load: number;
}

interface StateData {
  timestamp: string;
  totalAgentsActive: number;
  totalProjectsIndexed: number;
  runtimeAnomalies: number;
  activeSectors: Sector[];
}

interface RiskZone {
  zone: string;
  riskLevel: string;
  probability: number;
}

interface StabilityData {
  stability: number;
  chaosRisk: number;
  executionPressure: number;
  evolutionReadiness: number;
  riskZones: RiskZone[];
}

export default function CivilizationHealth() {
  const [state, setState] = useState<StateData | null>(null);
  const [stability, setStability] = useState<StabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [stateRes, stabRes]: [any, any] = await Promise.all([
          api.get('/meta-civilization/state'),
          api.get('/meta-civilization/stability')
        ]);
        
        if (stateRes.success) setState(stateRes.data);
        if (stabRes.success) setStability(stabRes.data);
      } catch (err) {
        console.error('Failed to load civilization data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    // Refresh every 5 seconds for a "live" feel
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 text-gray-100 bg-[#0f172a] min-h-screen">
      <div className="bg-[#1e293b]/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🌌</span> AI Meta-Civilization Core (Phase 61)
        </h1>
        <p className="text-sm text-gray-400">
          Global overview of all runtime states, engineering pressure, and civilization stability.
        </p>
      </div>

      {loading && !state ? (
        <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Civilization Stats Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#1e293b]/40 p-5 rounded-xl border border-gray-800 backdrop-blur flex flex-col justify-center items-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Active Agents</div>
                <div className="text-4xl font-bold text-blue-400">{state?.totalAgentsActive.toLocaleString()}</div>
              </div>
              <div className="bg-[#1e293b]/40 p-5 rounded-xl border border-gray-800 backdrop-blur flex flex-col justify-center items-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Projects Indexed</div>
                <div className="text-4xl font-bold text-purple-400">{state?.totalProjectsIndexed.toLocaleString()}</div>
              </div>
              <div className="bg-[#1e293b]/40 p-5 rounded-xl border border-gray-800 backdrop-blur flex flex-col justify-center items-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Anomalies</div>
                <div className="text-4xl font-bold text-red-400">{state?.runtimeAnomalies.toLocaleString()}</div>
              </div>
            </div>

            {/* Sector Topology Map */}
            <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md relative overflow-hidden">
              {/* Animated background pulses to simulate living network */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-[#0f172a] to-[#0f172a] animate-pulse"></div>
              
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 relative z-10">
                <span>🔭</span> Civilization Topology Map
              </h3>
              
              <div className="grid grid-cols-2 gap-4 relative z-10">
                {state?.activeSectors.map((sector, idx) => (
                  <div key={idx} className="bg-[#0f172a]/80 p-4 rounded-lg border border-gray-700/50">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-200">{sector.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${sector.status === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : sector.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                        {sector.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Nodes: <span className="text-gray-200">{sector.nodes.toLocaleString()}</span></span>
                      <span>Load: <span className={`font-bold ${sector.load > 85 ? 'text-red-400' : 'text-gray-200'}`}>{sector.load}%</span></span>
                    </div>
                    {/* Load bar */}
                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className={`h-full ${sector.load > 85 ? 'bg-red-500' : sector.load > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${sector.load}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stability Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <span>⚖️</span> Stability Index
              </h3>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Stability</span>
                    <span className="text-green-400 font-bold">{stability?.stability}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${stability?.stability}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Chaos Risk</span>
                    <span className="text-red-400 font-bold">{stability?.chaosRisk}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${stability?.chaosRisk}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Execution Pressure</span>
                    <span className="text-orange-400 font-bold">{stability?.executionPressure}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${stability?.executionPressure}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Evolution Readiness</span>
                    <span className="text-purple-400 font-bold">{stability?.evolutionReadiness}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full" style={{ width: `${stability?.evolutionReadiness}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
              <h3 className="text-sm uppercase tracking-wider font-semibold text-gray-400 mb-4">
                ⚠️ High-Risk Zones
              </h3>
              <div className="space-y-3">
                {stability?.riskZones.map((zone, idx) => (
                  <div key={idx} className="bg-[#0f172a]/50 p-3 rounded border border-gray-700/50 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-200">{zone.zone}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${zone.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : zone.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {zone.riskLevel}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Failure Probability: {zone.probability}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
