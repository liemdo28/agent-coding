import { useState } from 'react';

export default function ArchitectureIntelligence() {
  const [graph] = useState({
    nodes: [
      { id: 'App', type: 'root' },
      { id: 'Auth', type: 'service' },
      { id: 'API', type: 'service' },
      { id: 'Components', type: 'module' },
      { id: 'Utils', type: 'module' }
    ],
    edges: [
      { source: 'App', target: 'Auth' },
      { source: 'App', target: 'API' },
      { source: 'App', target: 'Components' },
      { source: 'Components', target: 'Utils' },
      { source: 'Auth', target: 'API' }
    ]
  });

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600">Nodes</h3>
          <p className="text-2xl font-bold text-blue-900">{graph.nodes.length}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-600">Edges</h3>
          <p className="text-2xl font-bold text-purple-900">{graph.edges.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-600">Framework</h3>
          <p className="text-lg font-bold text-green-900">React/Vite</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Dependency Graph</h3>
        <svg width="100%" height="300" className="border rounded">
          {graph.nodes.map((node, i) => {
            const x = 100 + (i % 3) * 200;
            const y = 80 + Math.floor(i / 3) * 120;
            return (
              <g key={node.id}>
                <circle cx={x} cy={y} r="30" fill={node.type === 'root' ? '#2563eb' : '#8b5cf6'} />
                <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="12">
                  {node.id.substring(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Risky Central Files</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm bg-gray-50">
              <th className="p-3">File</th>
              <th className="p-3">Incoming</th>
              <th className="p-3">Outgoing</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3 font-medium">App.jsx</td>
              <td className="p-3">5</td>
              <td className="p-3">3</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">config.js</td>
              <td className="p-3">8</td>
              <td className="p-3">2</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Framework Fingerprint</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Build Tool</p>
            <p className="font-medium">Vite</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">UI Framework</p>
            <p className="font-medium">React 18</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Routing</p>
            <p className="font-medium">React Router</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Styling</p>
            <p className="font-medium">Tailwind CSS</p>
          </div>
        </div>
      </div>
    </div>
  );
}