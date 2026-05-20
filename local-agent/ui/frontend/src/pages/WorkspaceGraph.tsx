// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

export default function WorkspaceGraph() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('all'); // all, active, duplicate, dead
  
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const animationFrameId = useRef(null);

  const loadStats = async () => {
    try {
      const res = await api.get('/indexer/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadProjects = async (q = '') => {
    try {
      setLoading(true);
      const res = await api.get(`/indexer/search?q=${q}`);
      if (res.success) {
        setProjects(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadProjects('');
  }, []);

  // Initialize node physics positions when projects or filter changes
  useEffect(() => {
    if (projects.length === 0) return;

    // Filter projects according to dropdown
    const filtered = projects.filter(p => {
      if (filterType === 'active') return p.activityStatus === 'active';
      if (filterType === 'dead') return p.activityStatus === 'dead';
      if (filterType === 'duplicate') return p.isDuplicate;
      return true;
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 500;

    // Create node objects with random positions
    const nodes = filtered.map((p, i) => {
      // Circular layout starting positions
      const angle = (i / filtered.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.35;
      return {
        id: p.path,
        name: p.name,
        type: p.type,
        isDuplicate: p.isDuplicate,
        activityStatus: p.activityStatus || 'active',
        path: p.path,
        remoteUrl: p.remoteUrl,
        branch: p.defaultBranch || p.branch,
        description: p.description,
        techStack: p.techStack || [],
        dependencies: p.dependencies || [],
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        r: p.isDuplicate ? 14 : 10,
      };
    });

    // Build connections between duplicates
    const links = [];
    const nameMap = {};
    nodes.forEach(n => {
      if (!nameMap[n.name]) {
        nameMap[n.name] = [];
      }
      nameMap[n.name].push(n);
    });

    Object.keys(nameMap).forEach(name => {
      const list = nameMap[name];
      if (list.length > 1) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            links.push({
              source: list[i],
              target: list[j],
              type: 'duplicate'
            });
          }
        }
      }
    });

    nodesRef.current = nodes;
    linksRef.current = links;

    // Auto-select first node if none selected
    if (nodes.length > 0 && !selectedNode) {
      setSelectedNode(nodes[0]);
    }
  }, [projects, filterType]);

  // Physics animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let hoveredNode = null;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      for (const node of nodesRef.current) {
        const dx = node.x - mouseX;
        const dy = node.y - mouseY;
        if (dx * dx + dy * dy < (node.r + 5) * (node.r + 5)) {
          found = node;
          break;
        }
      }
      hoveredNode = found;
      canvas.style.cursor = found ? 'pointer' : 'default';
    };

    const handleMouseClick = () => {
      if (hoveredNode) {
        setSelectedNode(hoveredNode);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleMouseClick);

    const updateAndRender = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Apply simple spring & layout forces
      for (let step = 0; step < 3; step++) {
        // 1. Repulsion between nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            if (dist < 100) {
              const force = (100 - dist) * 0.08;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              n1.vx -= fx;
              n1.vy -= fy;
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }

        // 2. Link gravity/spring force
        links.forEach(l => {
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 80;
          const force = (dist - targetDist) * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          l.source.vx += fx;
          l.source.vy += fy;
          l.target.vx -= fx;
          l.target.vy -= fy;
        });

        // 3. Gravity center pull & wall constraints
        nodes.forEach(n => {
          // Center gravity pull
          const cx = width / 2;
          const cy = height / 2;
          n.vx += (cx - n.x) * 0.005;
          n.vy += (cy - n.y) * 0.005;

          // Damp velocity
          n.vx *= 0.85;
          n.vy *= 0.85;

          // Apply position change
          n.x += n.vx;
          n.y += n.vy;

          // Contain
          n.x = Math.max(n.r + 5, Math.min(width - n.r - 5, n.x));
          n.y = Math.max(n.r + 5, Math.min(height - n.r - 5, n.y));
        });
      }

      // Draw background network layout
      ctx.clearRect(0, 0, width, height);

      // Draw GRID background for premium hacker look
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Links
      links.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // red link for duplicate repos
        ctx.stroke();

        // Pulsing dot along connection lines
        const t = (Date.now() / 1500) % 1;
        const pulseX = l.source.x + (l.target.x - l.source.x) * t;
        const pulseY = l.source.y + (l.target.y - l.source.y) * t;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      });

      // Draw Nodes
      nodes.forEach(n => {
        const isSelected = selectedNode && selectedNode.id === n.id;
        const isHovered = hoveredNode && hoveredNode.id === n.id;

        // Pulse effect for active nodes
        let pulseRadius = n.r;
        if (n.activityStatus === 'active') {
          pulseRadius = n.r + Math.sin(Date.now() / 200) * 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseRadius + 6, 0, Math.PI * 2);
          ctx.fillStyle = n.isDuplicate ? 'rgba(239,68,68,0.1)' : 'rgba(88,166,255,0.08)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);

        // Styling based on activity, redundant, types
        let fillColor = '#334155';
        let strokeColor = '#475569';

        if (n.isDuplicate) {
          fillColor = '#7f1d1d';
          strokeColor = '#ef4444';
        } else if (n.activityStatus === 'active') {
          fillColor = n.type === 'git-repo' ? '#0f2d5c' : '#064e3b';
          strokeColor = n.type === 'git-repo' ? '#58a6ff' : '#3fb950';
        } else {
          fillColor = '#1e293b';
          strokeColor = '#64748b';
        }

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isSelected ? '#ffffff' : (isHovered ? '#60a5fa' : strokeColor);
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.fill();
        ctx.stroke();

        // Node labels
        ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - n.r - 6);
      });

      animationFrameId.current = requestAnimationFrame(updateAndRender);
    };

    updateAndRender();

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleMouseClick);
    };
  }, [selectedNode]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadProjects(query);
  };

  const triggerScan = async () => {
    try {
      setScanning(true);
      const res = await api.post('/indexer/scan');
      if (res.success) {
        alert('Scan triggered! Re-indexing in the background.');
        setTimeout(() => {
          loadStats();
          loadProjects(query);
          setScanning(false);
        }, 3000);
      }
    } catch (err) {
      alert('Failed to trigger scan: ' + err.message);
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">Workspace Graph</h1>
          <p className="text-muted text-sm mt-1">Multi-repository dependency indexer and duplicate checkout analyzer.</p>
        </div>
        <button 
          className="btn btn-primary text-xs" 
          disabled={scanning} 
          onClick={triggerScan}
        >
          {scanning ? 'Scanning...' : 'Trigger Global Scan'}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-cyan-400">{stats.totalProjects}</div>
            <div className="text-xs text-muted">Indexed Paths</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-green-400">{stats.totalRepos}</div>
            <div className="text-xs text-muted">Git Repositories</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-red-400">
              {projects.filter(p => p.isDuplicate).length}
            </div>
            <div className="text-xs text-muted">Redundant/Duplicates</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xs font-mono text-slate-300 mt-1">
              {stats.lastScanned ? new Date(stats.lastScanned).toLocaleDateString() : 'Never'}
            </div>
            <div className="text-xs text-muted mt-2">Last Index Scan</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto md:flex-1">
          <input
            type="text"
            placeholder="Search repositories by name, paths..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 flex-1 focus:outline-none focus:border-cyan-500"
          />
          <button type="submit" className="btn btn-secondary text-xs">
            Search
          </button>
        </form>

        <div className="flex gap-2 w-full md:w-auto">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Show All Projects</option>
            <option value="active">Show Active Repos Only</option>
            <option value="dead">Show Dead Repos Only</option>
            <option value="duplicate">Show Duplicates Only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Canvas */}
        <div className="lg:col-span-2 neon-card p-0 overflow-hidden relative border border-slate-800 bg-slate-950/80 rounded-lg min-h-[450px] flex flex-col justify-end">
          <div className="absolute top-3 left-3 bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1 z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Active Repositories
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Redundant/Duplicates
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Dead Repositories (no commit &gt;90d)
            </div>
          </div>
          <canvas ref={canvasRef} className="w-full h-full flex-1 min-h-[400px]" />
        </div>

        {/* Sidebar details */}
        <div className="neon-card flex flex-col justify-between min-h-[450px]">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                  selectedNode.type === 'git-repo' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/60'
                }`}>
                  {selectedNode.type}
                </span>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 ml-2 rounded ${
                  selectedNode.activityStatus === 'active' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-red-950/40 text-red-400 border border-red-900/60'
                }`}>
                  {selectedNode.activityStatus}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-2 font-mono">{selectedNode.name}</h3>
                <p className="text-[10px] text-slate-500 font-mono break-all mt-1">{selectedNode.path}</p>
              </div>

              {selectedNode.description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Description</h4>
                  <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-900 leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>
              )}

              {selectedNode.remoteUrl && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Git Origin</h4>
                  <p className="text-xs font-mono text-slate-300 break-all bg-slate-900/50 p-2 rounded border border-slate-900">
                    {selectedNode.remoteUrl}
                  </p>
                </div>
              )}

              {selectedNode.branch && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Default Branch</h4>
                  <p className="text-xs font-mono text-cyan-300">{selectedNode.branch}</p>
                </div>
              )}

              {selectedNode.isDuplicate && (
                <div className="p-3 bg-red-950/35 border border-red-900/50 rounded text-xs text-red-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1">⚠️ REDUNDANT REPOSITORY CHECKOUT</div>
                  <div>This repository shares its identity or remote URL with other workspace directories. Recommended: consolidate to a single checkout path.</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted py-12">
              <span className="text-3xl mb-2">📁</span>
              <p className="text-sm font-mono">Select a node in the graph</p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>AOS Node Indexer</span>
            <span>v2.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
