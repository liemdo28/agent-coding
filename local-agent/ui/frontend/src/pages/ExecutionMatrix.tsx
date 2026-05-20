// pages/ExecutionMatrix.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface Task {
  id: string;
  name: string;
  status: string;
  impact: { infra: string; business: string; org: string };
}

interface Dependency {
  source: string;
  target: string;
  type: string;
}

interface PressureNode {
  system: string;
  load: number;
  status: string;
  activeTasks: number;
}

export default function ExecutionMatrix() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [pressure, setPressure] = useState<PressureNode[]>([]);
  const [targetTask, setTargetTask] = useState('task-100');
  const [cascade, setCascade] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatrix() {
      try {
        const [taskRes, pressureRes]: [any, any] = await Promise.all([
          api.get('/execution-matrix/tasks'),
          api.get('/execution-matrix/pressure')
        ]);
        
        if (taskRes.success) {
          setTasks(taskRes.data.tasks);
          setDependencies(taskRes.data.dependencies);
        }
        if (pressureRes.success) {
          setPressure(pressureRes.data);
        }
      } catch (err) {
        console.error('Failed to load matrix:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatrix();
  }, []);

  const triggerCascade = async () => {
    try {
      const res: any = await api.post('/execution-matrix/cascade-predict', { taskId: targetTask });
      if (res.success) {
        setCascade(res.data);
      }
    } catch (err) {
      console.error('Cascade reasoning failed:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 text-gray-100 bg-[#0f172a] min-h-screen">
      <div className="bg-[#1e293b]/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🌌</span> AI Global Execution Matrix (Phase 41)
        </h1>
        <p className="text-sm text-gray-400">
          Distributed intelligence fabric predicting failures, dependencies, and execution pressure.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Global Task Matrix */}
          <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🕸️</span> Global Task Matrix
            </h3>
            <div className="space-y-4">
              {tasks.map(t => (
                <div key={t.id} className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-200">{t.id}: {t.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded uppercase ${t.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-400">Infra: <span className={`font-medium ${t.impact.infra === 'high' ? 'text-orange-400' : 'text-gray-300'}`}>{t.impact.infra}</span></span>
                    <span className="text-gray-400">Business: <span className={`font-medium ${t.impact.business === 'critical' ? 'text-red-400' : 'text-gray-300'}`}>{t.impact.business}</span></span>
                    <span className="text-gray-400">Org: <span className="font-medium text-gray-300">{t.impact.org}</span></span>
                  </div>
                </div>
              ))}
            </div>
            
            <h4 className="text-xs text-gray-400 font-bold uppercase mt-6 mb-3">Dependencies</h4>
            <div className="space-y-2">
              {dependencies.map((d, i) => (
                <div key={i} className="flex items-center text-xs text-gray-300">
                  <span className="font-medium">{d.source}</span>
                  <span className="mx-2 text-gray-500">— {d.type} →</span>
                  <span className="font-medium">{d.target}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Execution Cascade Simulator */}
            <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>💥</span> Execution Cascade Engine
              </h3>
              <div className="flex gap-2 mb-4">
                <select 
                  value={targetTask}
                  onChange={e => setTargetTask(e.target.value)}
                  className="flex-1 bg-[#0f172a] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.id} - {t.name}</option>
                  ))}
                </select>
                <button 
                  onClick={triggerCascade}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition"
                >
                  Simulate
                </button>
              </div>
              
              <div className="bg-[#0f172a]/50 p-4 rounded border border-gray-800/50 min-h-[150px]">
                {cascade ? (
                  <div>
                    <div className="mb-4">
                      <span className="text-gray-400 text-sm">Blast Radius: </span>
                      <span className={`text-lg font-bold ${cascade.blastRadius > 1 ? 'text-red-400' : 'text-green-400'}`}>
                        {cascade.blastRadius} downstream tasks
                      </span>
                    </div>
                    {cascade.cascadeSteps.length > 0 ? (
                      <div className="space-y-2">
                        {cascade.cascadeSteps.map((step: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-gray-500 mt-1">↳</span>
                            <div className="bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm flex-1">
                              <div className="font-medium text-gray-200">{step.taskId}: {step.taskName}</div>
                              <div className="text-red-400 text-xs mt-1">{step.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm italic">No cascading impacts detected.</div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm italic py-8">
                    Select a task and simulate to see cascading impacts.
                  </div>
                )}
              </div>
            </div>

            {/* Execution Pressure Map */}
            <div className="bg-[#1e293b]/30 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📊</span> Execution Pressure Map
              </h3>
              <div className="space-y-3">
                {pressure.map((p, i) => (
                  <div key={i} className="bg-[#0f172a]/50 p-3 rounded border border-gray-800/50 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-200 text-sm mb-1">{p.system}</div>
                      <div className="text-xs text-gray-400">Active Tasks: {p.activeTasks}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-lg font-bold ${p.status === 'critical' ? 'text-red-500' : p.status === 'warning' ? 'text-yellow-500' : 'text-green-500'}`}>
                        {p.load}%
                      </span>
                      <span className="text-[10px] uppercase text-gray-500 tracking-widest">{p.status}</span>
                    </div>
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
