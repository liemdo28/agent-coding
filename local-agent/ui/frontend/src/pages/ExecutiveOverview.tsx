// @ts-nocheck
import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ExecutiveOverview() {
  const [data, setData] = useState({
    health: [], qaScores: [], alerts: [], modules: [], patches: [], resources: [], security: {}, dbHealth: {}
  });

  useEffect(() => {
    setData({
      health: [
        { name: 'Project A', status: 'healthy', qaScore: 92 },
        { name: 'Project B', status: 'warning', qaScore: 78 },
        { name: 'Project C', status: 'healthy', qaScore: 95 }
      ],
      qaScores: [
        { date: 'Mon', score: 85 }, { date: 'Tue', score: 88 },
        { date: 'Wed', score: 82 }, { date: 'Thu', score: 90 }, { date: 'Fri', score: 87 }
      ],
      alerts: [
        { id: 1, type: 'regression', message: 'Regression detected in user module', severity: 'high' },
        { id: 2, type: 'unstable', message: 'Utils module changed 5 times this week', severity: 'medium' }
      ],
      modules: [
        { name: 'auth', changes: 12, risk: 'high' },
        { name: 'api', changes: 8, risk: 'medium' },
        { name: 'ui', changes: 5, risk: 'low' }
      ],
      patches: { total: 24, risky: 3, applied: 21 },
      resources: [
        { time: '09:00', memory: 45 }, { time: '10:00', memory: 52 },
        { time: '11:00', memory: 48 }, { time: '12:00', memory: 61 }, { time: '13:00', memory: 58 }
      ],
      security: { issues: 0, warnings: 2, passed: 15 },
      dbHealth: { records: 1247, size: '2.3MB', status: 'healthy' }
    });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Project Health</h3>
          <p className="text-2xl font-bold text-blue-900">{data.health.filter(p => p.status === 'healthy').length}/{data.health.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">QA Score Trend</h3>
          <p className="text-2xl font-bold text-green-900">{data.qaScores[data.qaScores.length - 1]?.score || 0}%</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-600">Regression Alerts</h3>
          <p className="text-2xl font-bold text-red-900">{data.alerts.filter(a => a.severity === 'high').length}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-600">Risky Patches</h3>
          <p className="text-2xl font-bold text-yellow-900">{data.patches.risky}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">QA Score Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.qaScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Memory Growth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.resources}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="memory" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Unstable Modules</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm">
              <th className="pb-2">Module</th>
              <th className="pb-2">Changes (7 days)</th>
              <th className="pb-2">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {data.modules.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="py-2 font-medium">{m.name}</td>
                <td className="py-2">{m.changes}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-xs ${m.risk === 'high' ? 'bg-red-100 text-red-700' : m.risk === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {m.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
