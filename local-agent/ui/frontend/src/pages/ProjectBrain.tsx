// pages/ProjectBrain.tsx - UI for AI Project Brain (Self-Awareness & Auto-Documentation)
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

interface DNA {
  project_name: string;
  type: string;
  languages: string[];
  frameworks: string[];
  database: string;
  features: string[];
  audience: string;
  health_score: number;
}

interface AIProfile {
  businessPurpose: string;
  technicalPurpose: string;
  architecture: string;
  scalingRisk: string;
  securityRisk: string;
  aiReadiness: string;
}

export default function ProjectBrain() {
  const [selectedProject, setSelectedProject] = useState('rawwwebsite');
  const [dna, setDna] = useState<DNA | null>(null);
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [docsList, setDocsList] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);

  const projects = [
    { label: 'rawwebsite', value: 'rawwwebsite' },
    { label: 'dashboard', value: 'dashboard' },
    { label: 'agent-coding', value: 'ai' }
  ];

  // Load project brain info
  const loadBrainData = async (alias: string) => {
    setLoading(true);
    try {
      const res: any = await api.get(`/project-brain/analyze/${alias}?llm=false`);
      if (res.success && res.data) {
        setDna(res.data.dna);
        setProfile(res.data.profile);
      }
      
      // Load available documents list
      const docsRes: any = await api.get(`/project-brain/docs/${alias}`);
      if (docsRes.success) {
        setDocsList(docsRes.files || []);
        if (docsRes.files && docsRes.files.length > 0) {
          loadDocContent(alias, docsRes.files[0]);
        } else {
          setSelectedDoc(null);
          setDocContent('');
        }
      }
    } catch (err) {
      console.error('[ProjectBrain] Failed to load brain context:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocContent = async (alias: string, file: string) => {
    setDocLoading(true);
    setSelectedDoc(file);
    try {
      const res: any = await api.get(`/project-brain/docs/${alias}?file=${file}`);
      if (res.success) {
        setDocContent(res.content || '');
      }
    } catch (err) {
      console.error('[ProjectBrain] Failed to load document content:', err);
    } finally {
      setDocLoading(false);
    }
  };

  const triggerAnalyze = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/project-brain/analyze/${selectedProject}?llm=true`);
      if (res.success && res.data) {
        setDna(res.data.dna);
        setProfile(res.data.profile);
      }
    } catch (err) {
      alert('Error during full LLM analysis: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const triggerGenerateDocs = async () => {
    setGeneratingDocs(true);
    try {
      const res: any = await api.post(`/project-brain/document/${selectedProject}?llm=false`);
      if (res.success) {
        alert('All documentation set successfully generated!');
        loadBrainData(selectedProject);
      }
    } catch (err) {
      alert('Error generating docs: ' + (err as Error).message);
    } finally {
      setGeneratingDocs(false);
    }
  };

  useEffect(() => {
    loadBrainData(selectedProject);
  }, [selectedProject]);

  return (
    <div className="p-6 space-y-6 text-gray-100 bg-[#0f172a] min-h-screen">
      
      {/* Top Header & Selector bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e293b]/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🧠</span> AI Project Brain
          </h1>
          <p className="text-sm text-gray-400">Autonomous self-awareness, dependency maps, and automated project documentation.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-[#0f172a] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {projects.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          
          <button
            onClick={triggerAnalyze}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Full AI DNA'}
          </button>
          
          <button
            onClick={triggerGenerateDocs}
            disabled={generatingDocs}
            className="bg-[#10b981] hover:bg-[#059669] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingDocs ? 'Writing Docs...' : 'Generate Auto-Docs'}
          </button>
        </div>
      </div>

      {loading && !dna ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Project DNA Card */}
          <div className="bg-[#1e293b]/30 rounded-xl p-5 border border-gray-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                <h3 className="font-semibold text-lg text-white">🧬 Project DNA Map</h3>
                <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">
                  {dna?.type || 'App'}
                </span>
              </div>

              {dna && (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Project Name</span>
                    <span className="text-base font-medium text-white">{dna.project_name}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Ecosystem Database</span>
                    <span className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span> {dna.database}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Core Languages</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {dna.languages.map((l, i) => (
                        <span key={i} className="text-xs bg-[#0f172a] border border-gray-700 px-2.5 py-1 rounded">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Framework Stack</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {dna.frameworks.map((f, i) => (
                        <span key={i} className="text-xs bg-blue-900/20 border border-blue-800/30 text-blue-300 px-2.5 py-1 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Detected Capabilities/Features</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {dna.features.map((feat, i) => (
                        <span key={i} className="text-xs bg-[#334155]/40 text-gray-300 px-2 py-0.5 rounded">
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Radial score indicator */}
            {dna && (
              <div className="border-t border-gray-800 pt-4 mt-6 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block">Engineering Health Index</span>
                  <span className="text-lg font-bold text-white mt-1">{dna.health_score} / 100</span>
                </div>
                <div className="relative h-14 w-14 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" className="stroke-gray-800" strokeWidth="4" fill="transparent" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      className={`${dna.health_score > 80 ? 'stroke-emerald-500' : 'stroke-yellow-500'}`}
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 * (1 - dna.health_score / 100)}
                    />
                  </svg>
                  <span className="absolute text-xs font-bold">{dna.health_score}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: AI Profile Card */}
          <div className="bg-[#1e293b]/30 rounded-xl p-5 border border-gray-800 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-2">
              <h3 className="font-semibold text-lg text-white">🧠 Project AI Profile</h3>
              <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                profile?.aiReadiness === 'A' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                profile?.aiReadiness === 'B' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                AI Readiness: Grade {profile?.aiReadiness || 'C'}
              </span>
            </div>

            {profile && (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Business Purpose</span>
                  <p className="text-gray-300 leading-relaxed bg-[#0f172a]/30 p-2.5 rounded border border-gray-800/40">
                    {profile.businessPurpose}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 block mb-1">Technical Architecture</span>
                  <p className="text-gray-300 leading-relaxed bg-[#0f172a]/30 p-2.5 rounded border border-gray-800/40">
                    {profile.technicalPurpose}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Architecture Paradigm</span>
                    <span className="text-xs font-semibold text-white px-2 py-1 bg-[#1e293b] rounded block text-center truncate">
                      {profile.architecture}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Detected Routes</span>
                    <span className="text-xs font-semibold text-gray-300 px-2 py-1 bg-[#1e293b] rounded block text-center truncate">
                      {(profile as any).dependencies?.routeFiles?.length || 0} Modules
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-yellow-500/80 block mb-1">🔥 Production Scaling Risk</span>
                  <p className="text-xs text-yellow-200/70 bg-yellow-500/5 p-2 rounded border border-yellow-500/10 leading-relaxed">
                    {profile.scalingRisk}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-red-500/80 block mb-1">🔒 Security Vulnerability Assessment</span>
                  <p className="text-xs text-red-200/70 bg-red-500/5 p-2 rounded border border-red-500/10 leading-relaxed">
                    {profile.securityRisk}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Auto-Documentation Explorer */}
          <div className="bg-[#1e293b]/30 rounded-xl p-5 border border-gray-800 backdrop-blur-md flex flex-col h-[520px]">
            <div className="border-b border-gray-800 pb-3 mb-3">
              <h3 className="font-semibold text-lg text-white">📚 Auto-Documentation Explorer</h3>
            </div>

            {docsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <span className="text-3xl mb-2">📁</span>
                <p className="text-sm text-gray-400">No documentation files generated yet.</p>
                <button
                  onClick={triggerGenerateDocs}
                  className="mt-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded transition-colors"
                >
                  Write First Docs Set
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {docsList.map((doc) => (
                    <button
                      key={doc}
                      onClick={() => loadDocContent(selectedProject, doc)}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                        selectedDoc === doc
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1e293b] hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {doc.replace('.md', '')}
                    </button>
                  ))}
                </div>

                {/* Doc Preview Pane */}
                <div className="flex-1 bg-[#0f172a] border border-gray-800 rounded-lg p-3.5 overflow-y-auto text-xs font-mono">
                  {docLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap text-gray-300 leading-relaxed font-sans">
                      {docContent || 'Select a document tab above to preview.'}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
