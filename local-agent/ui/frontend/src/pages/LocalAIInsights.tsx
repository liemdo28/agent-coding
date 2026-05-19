// @ts-nocheck
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function LocalAIInsights() {
  const [data, setData] = useState({
    errors: [], fixes: [], components: [], framework: {}, confidence: []
  });

  useEffect(() => {
    setData({
      errors: [
        { type: 'TypeError', count: 12, lastSeen: '2h ago' },
        { type: 'ModuleNotFound', count: 8, lastSeen: '1d ago' },
        { type: 'ReferenceError', count: 5, lastSeen: '3d ago' }
      ],
      fixes: { success: 45, failed: 8, pending: 3 },
      components: [
        { name: 'AuthForm', issues: 5, stability: 'low' },
        { name: 'Dashboard', issues: 2, stability: 'high' },
        { name: 'UserProfile', issues: 3, stability: 'medium' }
      ],
      framework: {
        react: 35, vue: 10, nextjs: 25, express: 20
      },
      confidence: [
        { date: 'Mon', score: 72 },
        { date: 'Tue', score: 78 },
        { date: 'Wed', score: 75 },
        { date: 'Thu', score: 82 },
        { date: 'Fri', score: 85 }
      ]
    });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">Successful Fixes</h3>
          <p className="text-2xl font-bold text-green-900">{data.fixes.success}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-600">Failed Fixes</h3>
          <p className="text-2xl font-bold text-red-900">{data.fixes.failed}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Avg Confidence</h3>
          <p className="text-2xl font-bold text-blue-900">{data.confidence[data.confidence.length - 1]?.score || 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Top Recurring Errors</h3>
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm">
                <th className="pb-2">Error Type</th>
                <th className="pb-2">Count</th>
                <th className="pb-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {data.errors.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 font-medium">{e.type}</td>
                  <td className="py-2">{e.count}</td>
                  <td className="py-2 text-gray-500">{e.lastSeen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Confidence Trend</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data.confidence}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Unstable Components</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm bg-gray-50">
              <th className="p-3">Component</th>
              <th className="p-3">Issues</th>
              <th className="p-3">Stability</th>
            </tr>
          </thead>
          <tbody>
            {data.components.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.issues}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    c.stability === 'high' ? 'bg-green-100 text-green-700' :
                    c.stability === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {c.stability}
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