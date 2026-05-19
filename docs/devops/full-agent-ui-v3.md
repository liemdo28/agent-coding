# Full Agent UI / Digital Twin v3.0

## Implementation Map

| Capability | Primary file | Notes |
|---|---|---|
| Sidebar + topbar shell | `local-agent/ui/frontend/src/components/Layout.tsx` | Dark shell, active tab highlight, status badges. |
| Agent command/chat | `local-agent/ui/frontend/src/pages/Chat.tsx` | Agent conversation surface. |
| Project explorer | `local-agent/ui/frontend/src/pages/ProjectExplorer.tsx` | Project/task view; drag/drop source for assignment workflows. |
| Active tasks | `local-agent/ui/frontend/src/pages/ActiveTasks.tsx` | Task tracking surface; sort/filter patterns mirror Digital Twin. |
| Digital Twin v3 | `local-agent/ui/frontend/src/pages/CorporateDashboard.tsx` and `local-agent/ui/frontend/src/pages/DigitalTwin.tsx` | Integrated corporate view plus standalone `/digital-twin` view. |
| Simulation page | `local-agent/ui/frontend/src/pages/Simulation.tsx` | Dedicated simulation surface. |
| Offline iframe base | `local-agent/ui/frontend/public/dashboard_digital_twin_final.html` | Static offline dashboard loaded by the Digital Twin iframe. |
| Local API | `local-agent/ui/backend/routes/digital-twin.js` | `/task`, `/execution`, `/analytics`, `/simulation`. |

## Feature Checklist

| Area | Status | Implementation note |
|---|---|---|
| Predictive SLA overlay | Done | Company nodes use safe/warn/alert/danger risk bands from `/simulation`. |
| Multi-batch overlay | Done | Eight batch cards render progress, high-priority count, QA fail rate, and workers. |
| Slider interaction | Done | Priority weighting, worker allocation, and batch factor call local simulation. |
| Company enhancement | Done | Company cards show current batch, predicted risk, active tasks, QA fail rate, and worker pool. |
| Project/task shortcuts | Done | Task assignment posts to `/task`; sandbox build/fix posts to `/execution`. |
| Active task filtering | Done | Corporate task tab filters/sorts by priority, SLA risk, and batch. |
| Offline data path | Done | Runtime snapshots are written below `.local-agent/digital-twin/`; source is untouched. |
| Responsive layout | Done | Desktop/tablet breakpoints are in `app.css`. |

## Local API Contract

```txt
GET  /api/analytics
GET  /api/simulation
POST /api/simulation
GET  /api/task
POST /api/task
GET  /api/execution
POST /api/execution
```

All endpoints are offline/local-only and mounted on the existing UI backend at `127.0.0.1:4001`.

## Runbook

```bash
npm run ui:server
cd local-agent/ui/frontend
npm run build
```

Open:

```txt
http://127.0.0.1:4001/corporate
```

## Verification

```bash
npm test
npm run lint
npm run test:integration
cd local-agent/ui/frontend && npx tsc --noEmit && npm run build
```

Smoke-test API:

```bash
curl -s http://127.0.0.1:4001/api/analytics
curl -s -X POST http://127.0.0.1:4001/api/simulation \
  -H 'content-type: application/json' \
  -d '{"priorityWeight":80,"workerAllocation":256,"batchFactor":70}'
```
