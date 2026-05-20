// pages/WorldModel.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface SystemUnderstanding {
  architectureIntent: string;
  businessIntent: string;
  engineeringConstraints: string;
  longTermImpact: string;
}

interface GraphNode {
  id: string;
  type: string;
  group: string;
}

interface GraphLink {
  source: string;
  target: string;
  relationship: string;
}

interface OrgGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function WorldModel() {
  const [understanding, setUnderstanding] = useState<SystemUnderstanding | null>(null);
  const [orgGraph, setOrgGraph] = useState<OrgGraph | null>(null);
  const [causalEvent, setCausalEvent] = useState('websocket load increases');
  const [causalChain, setCausalChain] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorldModel() {
      try {
        const [sysRes, graphRes]: [any, any] = await Promise.all([
          api.get('/world-model/system-understanding/ai'),
          api.get('/world-model/organizational-graph')
        ]);
        
        if (sysRes.success) setUnderstanding(sysRes.data);
        if (graphRes.success) setOrgGraph(graphRes.data);
      } catch (err) {
        console.error('Failed to load world model:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWorldModel();
  }, []);

  const triggerCausalReasoning = async () => {
    try {
      const res: any = await api.post('/world-model/causal-reasoning', { event: causalEvent });
      if (res.success) {
        setCausalChain(res.data.chain);
      }
    } catch (err) {
      console.error('Causal reasoning failed:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 text-gray-100 bg-[#0f172a] min-h-screen">
      <div className="bg-[#1e293b]/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🌍</span> AI World Model (Phase 31)
        </h1>
        <p className="text-sm text-gray-400">
          Systems, Organizations, Relationships, Intent, and Consequences.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* System Understanding Engine */}
          <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🧠</span> System Understanding Engine
            </h3>
            {understanding && (
              <div className="space-y-4 text-sm">
                <div className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50">
                  <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block mb-1">Architecture Intent</span>
                  <p className="text-gray-300">{understanding.architectureIntent}</p>
                </div>
                <div className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50">
                  <span className="text-xs text-green-400 font-bold uppercase tracking-wider block mb-1">Business Intent</span>
                  <p className="text-gray-300">{understanding.businessIntent}</p>
                </div>
                <div className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50">
                  <span className="text-xs text-yellow-400 font-bold uppercase tracking-wider block mb-1">Engineering Constraints</span>
                  <p className="text-gray-300">{understanding.engineeringConstraints}</p>
                </div>
                <div className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50">
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-wider block mb-1">Long-term Impact</span>
                  <p className="text-gray-300">{understanding.longTermImpact}</p>
                </div>
              </div>
            )}
          </div>

          {/* Causal Reasoning Engine */}
          <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🔗</span> Causal Reasoning Engine
            </h3>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={causalEvent}
                onChange={e => setCausalEvent(e.target.value)}
                className="flex-1 bg-[#0f172a] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter event (e.g. database connection latency spikes)"
              />
              <button 
                onClick={triggerCausalReasoning}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition"
              >
                Analyze
              </button>
            </div>
            
            <div className="flex-1 bg-[#0f172a]/50 p-4 rounded border border-gray-800/50 overflow-y-auto">
              {causalChain.length > 0 ? (
                <div className="space-y-2">
                  {causalChain.map((step, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm text-gray-200">
                        {step}
                      </div>
                      {idx < causalChain.length - 1 && (
                        <div className="w-0.5 h-4 bg-blue-500/50 ml-4"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
                  Run reasoning to generate causal chain.
                </div>
              )}
            </div>
          </div>

          {/* Organizational Graph */}
          <div className="lg:col-span-2 bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🕸️</span> Organizational Graph
            </h3>
            {orgGraph && (
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex-1 min-w-[250px] bg-[#0f172a]/50 p-4 rounded border border-gray-800/50">
                  <h4 className="text-xs text-gray-400 font-bold uppercase mb-3">Nodes (Systems/Teams)</h4>
                  <ul className="space-y-2">
                    {orgGraph.nodes.map(n => (
                      <li key={n.id} className="flex justify-between items-center border-b border-gray-800 pb-1">
                        <span className="text-gray-200 font-medium">{n.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${
                          n.type === 'project' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {n.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex-[2] min-w-[300px] bg-[#0f172a]/50 p-4 rounded border border-gray-800/50">
                  <h4 className="text-xs text-gray-400 font-bold uppercase mb-3">Execution Chains & Dependencies</h4>
                  <ul className="space-y-2">
                    {orgGraph.links.map((l, i) => (
                      <li key={i} className="flex items-center text-gray-300">
                        <span className="font-medium text-white min-w-[100px] text-right">{l.source}</span>
                        <span className="mx-3 text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-400">
                          → {l.relationship} →
                        </span>
                        <span className="font-medium text-white">{l.target}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
