// @ts-nocheck
import { useState } from 'react';

export default function PatchWarRoom() {
  const [patches] = useState([
    { id: 1, status: 'applied', date: '2024-01-15', retries: 0, files: 3, impact: 'low' },
    { id: 2, status: 'failed', date: '2024-01-14', retries: 2, files: 7, impact: 'high' },
    { id: 3, status: 'rolled-back', date: '2024-01-13', retries: 1, files: 5, impact: 'medium' },
    { id: 4, status: 'applied', date: '2024-01-12', retries: 0, files: 2, impact: 'low' }
  ]);

  const statusColors = {
    applied: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    'rolled-back': 'bg-yellow-100 text-yellow-700'
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-600">Total Patches</h3>
          <p className="text-2xl font-bold text-purple-900">{patches.length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-600">Failed</h3>
          <p className="text-2xl font-bold text-red-900">{patches.filter(p => p.status === 'failed').length}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-600">Rollbacks</h3>
          <p className="text-2xl font-bold text-yellow-900">{patches.filter(p => p.status === 'rolled-back').length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Avg Retries</h3>
          <p className="text-2xl font-bold text-blue-900">
            {(patches.reduce((s, p) => s + p.retries, 0) / patches.length).toFixed(1)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Patch Timeline</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            {patches.map((patch, i) => (
              <div key={patch.id} className="flex-1 flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full ${patch.status === 'applied' ? 'bg-green-500' : patch.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                {i < patches.length - 1 && <div className="w-full h-0.5 bg-gray-300" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            {patches.map(p => (
              <span key={p.id}>{p.date}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Patch Details</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm bg-gray-50">
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Retries</th>
              <th className="p-3">Files</th>
              <th className="p-3">Impact</th>
            </tr>
          </thead>
          <tbody>
            {patches.map(patch => (
              <tr key={patch.id} className="border-t">
                <td className="p-3">{patch.date}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[patch.status]}`}>
                    {patch.status}
                  </span>
                </td>
                <td className="p-3">{patch.retries}</td>
                <td className="p-3">{patch.files}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    patch.impact === 'high' ? 'bg-red-100 text-red-700' :
                    patch.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {patch.impact}
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