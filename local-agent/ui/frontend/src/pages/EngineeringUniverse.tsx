// pages/EngineeringUniverse.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface Node {
  id: string;
  type: string;
  name: string;
  energy: number;
  cluster: string;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface PhysicsData {
  realityDrift: number;
  executionInstability: number;
  organizationalEntropy: number;
  civilizationPressure: number;
  timestamp: string;
}

export default function EngineeringUniverse() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [physics, setPhysics] = useState<PhysicsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [graphRes, physRes]: [any, any] = await Promise.all([
          api.get('/meta-reality/graph'),
          api.get('/meta-reality/stability')
        ]);
        
        if (graphRes.success) setGraph(graphRes.data);
        if (physRes.success) setPhysics(physRes.data);
      } catch (err) {
        console.error('Failed to load reality data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 text-gray-100 bg-[#020617] min-h-screen">
      <div className="bg-[#0f172a]/50 p-4 rounded-xl border border-gray-800 flex justify-between items-center backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🌌</span> Engineering Universe (Phase 81)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Meta-reality graph of the living civilization engineering physics.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-green-400 font-mono flex items-center gap-2 justify-end">
            <span className="animate-pulse h-2 w-2 bg-green-500 rounded-full inline-block"></span>
            REALITY LINK ACTIVE
          </div>
          <div className="text-[10px] text-gray-500 mt-1">{physics?.timestamp}</div>
        </div>
      </div>

      {loading && !graph ? (
        <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Engineering Physics Dials */}
          <div className="space-y-4">
            <div className="bg-[#0f172a]/80 p-5 rounded-xl border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span>⚛️</span> Reality Physics
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Reality Drift</span>
                    <span className="text-orange-400 font-mono">{physics?.realityDrift}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                    <div className="bg-orange-500 h-full" style={{ width: `${physics?.realityDrift}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Execution Instability</span>
                    <span className="text-red-400 font-mono">{physics?.executionInstability}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                    <div className="bg-red-500 h-full" style={{ width: `${physics?.executionInstability}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Org Entropy</span>
                    <span className="text-purple-400 font-mono">{physics?.organizationalEntropy} eUnits</span>
                  </div>
                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                    <div className="bg-purple-500 h-full" style={{ width: `${Math.min(100, (physics?.organizationalEntropy || 0))}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Civilization Pressure</span>
                    <span className="text-blue-400 font-mono">{physics?.civilizationPressure} pUnits</span>
                  </div>
                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (physics?.civilizationPressure || 0))}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Living Universe Graph Visualizer */}
          <div className="lg:col-span-3 bg-black/40 p-5 rounded-xl border border-gray-800 relative min-h-[500px] overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent"></div>
            
            <h3 className="text-sm font-semibold text-gray-300 mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
              <span>🕸️</span> Meta-Reality Graph Network
            </h3>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {graph?.nodes.map((node, idx) => {
                const colors: Record<string, string> = {
                  system: 'bg-blue-900/30 border-blue-500/50 text-blue-300',
                  intent: 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300',
                  consequence: 'bg-red-900/30 border-red-500/50 text-red-300'
                };
                
                return (
                  <div key={idx} className={`p-4 rounded-lg border backdrop-blur-sm flex flex-col gap-2 ${colors[node.type] || 'bg-gray-800'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase px-1.5 py-0.5 rounded-sm bg-black/50">{node.type}</span>
                        <span className="font-bold">{node.name}</span>
                      </div>
                      <span className="text-xs opacity-70">Energy: {node.energy}</span>
                    </div>
                    
                    {/* Render connected edges for this node */}
                    <div className="mt-2 pt-2 border-t border-current/20">
                      <div className="text-[10px] uppercase opacity-60 mb-1">Connections</div>
                      {graph.edges.filter(e => e.source === node.id).map((edge, eidx) => {
                        const targetNode = graph.nodes.find(n => n.id === edge.target);
                        return (
                          <div key={eidx} className="text-xs flex items-center gap-2 text-current/80">
                            <span>↳</span>
                            <span className="italic">[{edge.type}]</span>
                            <span>{targetNode?.name || edge.target}</span>
                            <span className="opacity-50">(w: {edge.weight})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
