import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout         from './components/Layout.jsx';
import Dashboard      from './pages/Dashboard.jsx';
import Scanner        from './pages/Scanner.jsx';
import Chat           from './pages/Chat.jsx';
import Patches        from './pages/Patches.jsx';
import QA             from './pages/QA.jsx';
import Reports        from './pages/Reports.jsx';
import Memory         from './pages/Memory.jsx';
import Security       from './pages/Security.jsx';
import CommandCenter  from './pages/CommandCenter.jsx';
import ActivityLog    from './pages/ActivityLog.jsx';
import Architecture   from './pages/Architecture.jsx';
import KPICharts      from './pages/KPICharts.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index                   element={<Dashboard />} />
          <Route path="command-center"   element={<CommandCenter />} />
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
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
