// @ts-nocheck
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout             from './components/Layout.tsx';
import Dashboard          from './pages/Dashboard.tsx';
import Scanner            from './pages/Scanner.tsx';
import Chat               from './pages/Chat.tsx';
import Patches            from './pages/Patches.tsx';
import QA                 from './pages/QA.tsx';
import Reports            from './pages/Reports.tsx';
import Memory             from './pages/Memory.tsx';
import Security           from './pages/Security.tsx';
import CommandCenter      from './pages/CommandCenter.tsx';
import ActivityLog        from './pages/ActivityLog.tsx';
import Architecture       from './pages/Architecture.tsx';
import KPICharts          from './pages/KPICharts.tsx';
import CorporateDashboard from './pages/CorporateDashboard.tsx';
import ProjectExplorer    from './pages/ProjectExplorer.tsx';
import ActiveTasks        from './pages/ActiveTasks.tsx';
import Simulation         from './pages/Simulation.tsx';
import DigitalTwin        from './pages/DigitalTwin.tsx';
import Reasoning          from './pages/Reasoning.tsx';
import Agents             from './pages/Agents.tsx';
import WorkspaceGraph     from './pages/WorkspaceGraph.tsx';
import AutonomousQueue   from './pages/AutonomousQueue.tsx';
import KnowledgeBase      from './pages/KnowledgeBase.tsx';
import RuntimeMonitor     from './pages/RuntimeMonitor.tsx';
import Timeline          from './pages/Timeline.tsx';import ProjectHealth      from './pages/ProjectHealth.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index                   element={<Dashboard />} />
          <Route path="command-center"   element={<CommandCenter />} />
          <Route path="project-health"   element={<ProjectHealth />} />
          <Route path="activity-log"     element={<ActivityLog />} />
          <Route path="scanner"          element={<Scanner />} />
          <Route path="chat"             element={<Chat />} />
          <Route path="patches"          element={<Patches />} />
          <Route path="qa"               element={<QA />} />
          <Route path="reports"          element={<Reports />} />
          <Route path="memory"           element={<Memory />} />
          <Route path="security"         element={<Security />} />
          <Route path="architecture"     element={<Architecture />} />
          <Route path="kpi"              element={<KPICharts />} />
          <Route path="corporate"        element={<CorporateDashboard />} />
          <Route path="projects"         element={<ProjectExplorer />} />
          <Route path="active-tasks"     element={<ActiveTasks />} />
          <Route path="simulation"       element={<Simulation />} />
          <Route path="digital-twin"     element={<DigitalTwin />} />
          <Route path="reasoning"        element={<Reasoning />} />
          <Route path="agents"           element={<Agents />} />
          <Route path="workspace-graph"  element={<WorkspaceGraph />} />
          <Route path="autonomous-queue" element={<AutonomousQueue />} />
          <Route path="knowledge-base"   element={<KnowledgeBase />} />
          <Route path="runtime-monitor"  element={<RuntimeMonitor />} />
          <Route path="timeline"         element={<Timeline />} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
