#!/usr/bin/env python3
"""prototypes/gen_dashboard_interactive.py
Super Agent v2.0 – Interactive Digital Twin Dashboard Generator.

Generates a fully self-contained offline HTML file (no CDN, no server needed).
Reads real data from .super-agent-fullauto-kpi/*.json if present,
otherwise generates synthetic data for 100 companies / 512 workers.

Usage:
    python3 prototypes/gen_dashboard_interactive.py
    open .super-agent-fullauto-kpi/dashboard_interactive.html
"""

import json
import math
import random
from pathlib import Path
from datetime import datetime, timedelta

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent.parent
BASE_DIR      = ROOT / ".super-agent-fullauto-kpi"
EXEC_SUM_PATH = BASE_DIR / "execution_summary.json"
ANALYTICS_PATH = BASE_DIR / "analytics.json"
SIM_REPORT_PATH = BASE_DIR / "simulation_report.json"
OUTPUT_HTML   = BASE_DIR / "dashboard_interactive.html"

N_COMPANIES = 100
N_WORKERS   = 512

# ── Synthetic data generator ───────────────────────────────────────────────────

_PREFIXES = ["Alpha","Beta","Gamma","Delta","Epsilon","Zeta","Eta","Theta",
             "Iota","Kappa","Lambda","Mu","Nu","Xi","Omicron","Pi",
             "Rho","Sigma","Tau","Upsilon"]
_SUFFIXES = ["Corp","Ltd","Inc","Group","Holdings","Systems","Solutions",
             "Technologies","Ventures","Partners"]

def _company_name(i):
    return f"{_PREFIXES[i % len(_PREFIXES)]} {_SUFFIXES[(i*3+7) % len(_SUFFIXES)]}"

def generate_synthetic_data(n_companies=N_COMPANIES, n_workers=N_WORKERS, seed=42):
    random.seed(seed)
    now = datetime.now()

    companies = [_company_name(i) for i in range(n_companies)]
    workers   = [f"W{i:04d}" for i in range(1, n_workers + 1)]
    skills    = {w: random.choice(["dev","qa","devops","ml","data"]) for w in workers}

    tasks = []
    for ci, company in enumerate(companies):
        is_high_pressure = (ci % 7 == 0)
        n_tasks = random.randint(30, 200) if is_high_pressure else random.randint(10, 80)
        for _ in range(n_tasks):
            priority = random.choices(["P1","P2","P3"], weights=[1, 3, 6])[0]
            hours_ago = random.uniform(0, 72)
            start = now - timedelta(hours=hours_ago)
            duration_h = round(random.uniform(0.1, 8.0), 2)
            dev_status = random.choices(
                ["DEV_DONE","DEV_RUNNING","DEV_FAILED"],
                weights=[7, 2, 3 if priority == "P1" else 1]
            )[0]
            qa_status = ("QA_SKIP" if dev_status != "DEV_DONE"
                         else random.choices(["QA_PASS","QA_FAIL","QA_SKIP"],
                                             weights=[8, 2, 1])[0])
            sla_h = {"P1": 4, "P2": 24, "P3": 72}[priority]
            deadline = start + timedelta(hours=sla_h)
            sla_breach = (deadline < now) and dev_status != "DEV_DONE"
            worker = random.choice(workers)
            tasks.append({
                "task_id":         f"T{len(tasks)+1:06d}",
                "company":         company,
                "priority":        priority,
                "dev_status":      dev_status,
                "qa_status":       qa_status,
                "assigned_worker": worker,
                "worker_skill":    skills[worker],
                "duration_h":      duration_h,
                "sla_breach":      sla_breach,
                "started_at":      start.strftime("%Y-%m-%dT%H:%M:%S"),
            })

    util = {}
    for t in tasks:
        util[t["assigned_worker"]] = util.get(t["assigned_worker"], 0) + 1

    qa_eligible = [t for t in tasks if t["qa_status"] != "QA_SKIP"]
    analytics = {
        "generated_at":       now.isoformat(),
        "total_companies":    n_companies,
        "total_workers":      n_workers,
        "total_tasks":        len(tasks),
        "completion_rate":    round(sum(1 for t in tasks if t["dev_status"] == "DEV_DONE") / len(tasks), 4),
        "sla_breach_rate":    round(sum(1 for t in tasks if t["sla_breach"]) / len(tasks), 4),
        "qa_pass_rate":       round(sum(1 for t in qa_eligible if t["qa_status"] == "QA_PASS") / max(1, len(qa_eligible)), 4),
        "worker_utilization": util,
    }
    return tasks, companies, workers, analytics

# ── Load or generate ───────────────────────────────────────────────────────────

def load_data():
    if EXEC_SUM_PATH.exists():
        print(f"Loading existing data from {EXEC_SUM_PATH}")
        tasks = json.loads(EXEC_SUM_PATH.read_text())
        companies = sorted(set(t["company"] for t in tasks))
        workers   = sorted(set(t["assigned_worker"] for t in tasks))
        if ANALYTICS_PATH.exists():
            analytics = json.loads(ANALYTICS_PATH.read_text())
        else:
            analytics = {}
        return tasks, companies, workers, analytics
    else:
        print("No existing data found — generating synthetic data…")
        tasks, companies, workers, analytics = generate_synthetic_data()
        BASE_DIR.mkdir(exist_ok=True)
        EXEC_SUM_PATH.write_text(json.dumps(tasks, indent=2))
        ANALYTICS_PATH.write_text(json.dumps(analytics, indent=2))
        print(f"Saved {len(tasks)} tasks to {EXEC_SUM_PATH}")
        return tasks, companies, workers, analytics

# ── HTML builder ───────────────────────────────────────────────────────────────

def _css():
    return """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f1117;color:#e2e8f0;display:flex;min-height:100vh;font-size:14px}
#sidebar{width:220px;min-height:100vh;background:#1a1d2e;padding:20px 14px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid #1e293b}
#sidebar .logo{font-size:13px;font-weight:800;color:#f1f5f9;margin-bottom:4px}
#sidebar .logo span{color:#3b82f6}
#sidebar .logo-sub{font-size:10px;color:#475569;margin-bottom:20px}
.sb-kpi{background:#1e293b;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #2d3748}
.sb-kpi .lb{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.sb-kpi .val{font-size:24px;font-weight:800;color:#f1f5f9;line-height:1.1;margin:3px 0}
.sb-kpi .sub{font-size:11px;color:#94a3b8}
.sb-kpi.alert .val{color:#f87171}
.sb-kpi.warn .val{color:#fb923c}
.sb-kpi.good .val{color:#34d399}
.nav-sec{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 6px;padding-top:12px;border-top:1px solid #1e293b}
.nav-item{display:block;padding:7px 10px;border-radius:6px;color:#64748b;font-size:12px;cursor:pointer;margin-bottom:2px;text-decoration:none;transition:background .15s}
.nav-item:hover{background:#2d3748;color:#e2e8f0}
#main{flex:1;padding:24px 28px;overflow-y:auto;max-width:1400px}
.page-header{margin-bottom:24px}
.page-header h1{font-size:18px;font-weight:700;color:#f1f5f9}
.page-header p{font-size:12px;color:#475569;margin-top:3px}
.section{margin-bottom:36px}
.sec-title{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.sec-title::after{content:'';flex:1;height:1px;background:#1e293b}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:0}
.card{background:#1e293b;border-radius:10px;padding:16px;border:1px solid #2d3748}
.card .lb{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.card .val{font-size:26px;font-weight:800;color:#f1f5f9;margin:5px 0;line-height:1}
.card .sub{font-size:11px;color:#94a3b8}
.card.alert .val{color:#f87171}
.card.warn .val{color:#fb923c}
.card.good .val{color:#34d399}
.panel{background:#111827;border:1px solid #1e293b;border-radius:10px;padding:18px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.heatmap-wrap{overflow-x:auto}
table.hm{border-collapse:separate;border-spacing:3px}
.hc{width:86px;height:44px;border-radius:5px;cursor:pointer;transition:filter .15s,outline .1s;vertical-align:middle;text-align:center;padding:2px 3px;position:relative}
.hc:hover{filter:brightness(1.25);outline:2px solid #60a5fa}
.hc .cn{font-size:8px;color:rgba(255,255,255,.85);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px}
.hc .ct{font-size:16px;font-weight:900;line-height:1.1}
.hc .cs{font-size:8px;color:#fbbf24}
.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:11px}
.bar-row .bl{width:72px;color:#64748b;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.bar-row .bt{flex:1;background:#1e293b;height:13px;border-radius:2px;overflow:hidden}
.bar-row .bf{height:100%;border-radius:2px}
.bar-row .bv{width:30px;text-align:right;color:#64748b;flex-shrink:0;font-size:11px}
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
.filter-bar input{background:#1e293b;border:1px solid #2d3748;border-radius:6px;padding:6px 10px;color:#e2e8f0;font-size:12px;width:180px}
.filter-bar input:focus{outline:none;border-color:#3b82f6}
.fb{padding:4px 10px;border-radius:5px;border:1px solid #2d3748;background:transparent;color:#64748b;font-size:11px;cursor:pointer;transition:all .15s}
.fb:hover,.fb.on{background:#2563eb;border-color:#2563eb;color:#fff}
.active-filter{font-size:11px;color:#60a5fa;padding:4px 8px;background:#1e3a5f;border-radius:4px;display:none}
.tbl-wrap{overflow-x:auto;max-height:380px;overflow-y:auto;border-radius:8px;border:1px solid #1e293b}
table.tbl{width:100%;border-collapse:collapse;font-size:12px}
table.tbl thead{position:sticky;top:0;background:#1a1d2e;z-index:2}
table.tbl th{padding:9px 12px;text-align:left;color:#475569;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #1e293b;white-space:nowrap}
table.tbl td{padding:7px 12px;border-bottom:1px solid #111827;color:#94a3b8;white-space:nowrap}
table.tbl tbody tr:hover{background:#1e293b}
.b{display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase}
.bp1{background:#7f1d1d;color:#fca5a5}
.bp2{background:#78350f;color:#fcd34d}
.bp3{background:#1e3a5f;color:#93c5fd}
.bdo{background:#064e3b;color:#6ee7b7}
.bdr{background:#1e3a5f;color:#93c5fd}
.bdf{background:#7f1d1d;color:#fca5a5}
.bqp{background:#064e3b;color:#6ee7b7}
.bqf{background:#7f1d1d;color:#fca5a5}
.bqs{background:#1e293b;color:#475569}
.bbr{background:#7f1d1d;color:#f87171}
.svg-chart{width:100%;overflow:visible}
#tooltip{position:fixed;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-size:12px;pointer-events:none;z-index:9999;display:none;max-width:220px;box-shadow:0 4px 24px #0008}
#tooltip h4{font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:5px}
#tooltip p{color:#64748b;margin-bottom:2px;line-height:1.5}
#tooltip .tv{color:#e2e8f0;font-weight:600}
.file-hint{font-size:11px;color:#475569;margin-top:8px;display:flex;align-items:center;gap:8px}
.file-hint input[type=file]{font-size:11px;color:#64748b}
"""

def _js(tasks_json, analytics_json, companies_json):
    return f"""
const TASKS = {tasks_json};
const ANALYTICS = {analytics_json};
const COMPANIES = {companies_json};

let fCo=null,fPr=null,fSt=null,fSr='';

// ── Color helpers ──────────────────────────────────────────────────────────────
function heatColor(loadFrac, breachFrac) {{
  const r = Math.round(30  + breachFrac * 200 + loadFrac * 60);
  const g = Math.round(160 - loadFrac * 130    - breachFrac * 110);
  const b = Math.round(40  + loadFrac * 20);
  return `rgb(${{Math.min(255,r)}},${{Math.max(0,g)}},${{Math.max(0,b)}})`;
}}
function pct(n,d){{return d?Math.round(n*100/d):0;}}
const PCLR = {{P1:'#ef4444',P2:'#f97316',P3:'#3b82f6'}};
const WCLR = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6'];

// ── Company stats ──────────────────────────────────────────────────────────────
function coStats() {{
  const m={{}};
  for(const t of TASKS){{
    if(!m[t.company]) m[t.company]={{total:0,done:0,fail:0,qaFail:0,breach:0,p1:0,p2:0,p3:0}};
    const s=m[t.company];
    s.total++;
    if(t.dev_status==='DEV_DONE') s.done++;
    if(t.dev_status==='DEV_FAILED') s.fail++;
    if(t.qa_status==='QA_FAIL') s.qaFail++;
    if(t.sla_breach) s.breach++;
    s[t.priority.toLowerCase()]++;
  }}
  return m;
}}

// ── Tooltip ────────────────────────────────────────────────────────────────────
const tt = document.getElementById('tooltip');
document.addEventListener('mousemove',e=>{{
  if(tt.style.display==='block'){{
    tt.style.left=(e.clientX+16)+'px';
    tt.style.top=(Math.min(e.clientY-10, window.innerHeight-180))+'px';
  }}
}});
function hideTT(){{tt.style.display='none';}}
function showTT(e,html){{tt.innerHTML=html;tt.style.display='block';}}

// ── Heatmap ────────────────────────────────────────────────────────────────────
function renderHeatmap(){{
  const stats=coStats();
  const maxLoad=Math.max(...COMPANIES.map(c=>stats[c]?.total??0));
  const cols=10;
  let html='<table class="hm"><tbody>';
  for(let r=0;r<Math.ceil(COMPANIES.length/cols);r++){{
    html+='<tr>';
    for(let col=0;col<cols;col++){{
      const ci=r*cols+col;
      if(ci>=COMPANIES.length){{html+='<td></td>';continue;}}
      const c=COMPANIES[ci];
      const s=stats[c]??{{total:0,breach:0,fail:0,done:0}};
      const lf=s.total/(maxLoad||1);
      const bf=s.total>0?s.breach/s.total:0;
      const bg=heatColor(lf,bf);
      const short=c.length>11?c.slice(0,10)+'…':c;
      const esc=c.replace(/'/g,"\\'");
      html+=`<td class="hc" style="background:${{bg}}" onclick="filterCo('${{esc}}')"
        onmouseenter="showTT(event,'<h4>${{c}}</h4><p>Tasks: <span class=tv>${{s.total}}</span></p><p>Done: <span class=tv style=color:#34d399>${{pct(s.done,s.total)}}%</span></p><p>SLA breach: <span class=tv style=color:#f87171>${{s.breach}}</span></p><p>Dev fail: <span class=tv style=color:#f87171>${{s.fail}}</span></p><p style=font-size:10px;margin-top:6px;color:#475569>Click to filter ↓</p>')"
        onmouseleave="hideTT()">
        <div class="cn">${{short}}</div>
        <div class="ct" style="color:${{s.breach>0?'#fbbf24':'#f1f5f9'}}">${{s.total}}</div>
        ${{s.breach>0?`<div class="cs">⚠ ${{s.breach}}</div>`:''}}
      </td>`;
    }}
    html+='</tr>';
  }}
  html+='</tbody></table>';
  document.getElementById('heatmap-grid').innerHTML=html;
}}

// ── Worker bars ────────────────────────────────────────────────────────────────
function renderWorkerBars(){{
  const util=ANALYTICS.worker_utilization??{{}};
  const sorted=Object.entries(util).sort((a,b)=>b[1]-a[1]).slice(0,24);
  const max=sorted[0]?.[1]||1;
  document.getElementById('worker-bars').innerHTML=sorted.map(([w,n],i)=>
    `<div class="bar-row">
      <span class="bl">${{w}}</span>
      <div class="bt"><div class="bf" style="width:${{pct(n,max)}}%;background:${{WCLR[i%WCLR.length]}}"></div></div>
      <span class="bv">${{n}}</span>
    </div>`
  ).join('');
}}

// ── Priority stacked bars (SVG) ────────────────────────────────────────────────
function renderPriorityChart(){{
  const p={{P1:{{done:0,run:0,fail:0}},P2:{{done:0,run:0,fail:0}},P3:{{done:0,run:0,fail:0}}}};
  for(const t of TASKS){{
    const k=t.dev_status==='DEV_DONE'?'done':t.dev_status==='DEV_RUNNING'?'run':'fail';
    p[t.priority][k]++;
  }}
  const pris=['P1','P2','P3'];
  const W=560,H=200,pad=40,bw=80,gap=60;
  let bars='',labels='';
  pris.forEach((pri,i)=>{{
    const total=p[pri].done+p[pri].run+p[pri].fail;
    const x=pad+i*(bw+gap);
    const maxH=H-50;
    let yOff=H-20;
    [['#10b981',p[pri].done,'Done'],['#3b82f6',p[pri].run,'Running'],['#ef4444',p[pri].fail,'Failed']].forEach(([col,n,lbl])=>{{
      if(!n)return;
      const h=total>0?(n/total)*maxH:0;
      yOff-=h;
      bars+=`<rect x="${{x}}" y="${{yOff}}" width="${{bw}}" height="${{h}}" fill="${{col}}" rx="3"><title>${{lbl}}: ${{n}}</title></rect>`;
      if(h>16) bars+=`<text x="${{x+bw/2}}" y="${{yOff+h/2+4}}" text-anchor="middle" fill="rgba(255,255,255,.8)" font-size="10">${{n.toLocaleString()}}</text>`;
    }});
    labels+=`<text x="${{x+bw/2}}" y="${{H-6}}" text-anchor="middle" fill="${{PCLR[pri]}}" font-size="13" font-weight="700">${{pri}}</text>`;
    labels+=`<text x="${{x+bw/2}}" y="${{H-20}}" text-anchor="middle" fill="#94a3b8" font-size="10">${{total.toLocaleString()}}</text>`;
  }});
  const leg=`<rect x="0" y="4" width="10" height="10" fill="#10b981" rx="2"/><text x="14" y="13" fill="#64748b" font-size="10">Done</text>
    <rect x="60" y="4" width="10" height="10" fill="#3b82f6" rx="2"/><text x="74" y="13" fill="#64748b" font-size="10">Running</text>
    <rect x="130" y="4" width="10" height="10" fill="#ef4444" rx="2"/><text x="144" y="13" fill="#64748b" font-size="10">Failed</text>`;
  document.getElementById('priority-chart').innerHTML=
    `<svg viewBox="0 0 ${{W}} ${{H}}" class="svg-chart">${{bars}}${{labels}}${{leg}}</svg>`;
}}

// ── SLA risk scatter (SVG) ─────────────────────────────────────────────────────
function renderSLAScatter(){{
  const stats=coStats();
  const W=560,H=220,px=50,py=30;
  const entries=COMPANIES.map(c=>{{
    const s=stats[c]??{{total:0,breach:0}};
    return [c,s.total,s.total>0?s.breach/s.total:0];
  }});
  const maxT=Math.max(...entries.map(e=>e[1]));
  let dots='';
  entries.forEach(([c,total,breachFrac])=>{{
    const x=px+(total/maxT)*(W-px*2);
    const y=py+(1-breachFrac)*(H-py*2);
    const r=Math.max(3,Math.min(10,total/maxT*10));
    const col=breachFrac>0.3?'#ef4444':breachFrac>0.1?'#f97316':'#3b82f6';
    const esc=c.replace(/'/g,"\\'");
    dots+=`<circle cx="${{x}}" cy="${{y}}" r="${{r}}" fill="${{col}}" opacity=".75" style="cursor:pointer"
      onmouseenter="showTT(event,'<h4>${{c}}</h4><p>Tasks: <span class=tv>${{total}}</span></p><p>SLA breach: <span class=tv style=color:#f87171>${{Math.round(breachFrac*100)}}%</span></p>')"
      onmouseleave="hideTT()"
      onclick="filterCo('${{esc}}')"/>`;
  }});
  const axes=`
    <line x1="${{px}}" y1="${{py}}" x2="${{px}}" y2="${{H-py}}" stroke="#2d3748"/>
    <line x1="${{px}}" y1="${{H-py}}" x2="${{W-px}}" y2="${{H-py}}" stroke="#2d3748"/>
    <text x="${{W/2}}" y="${{H-4}}" text-anchor="middle" fill="#475569" font-size="10">Task Load →</text>
    <text x="14" y="${{H/2}}" text-anchor="middle" fill="#475569" font-size="10" transform="rotate(-90,14,${{H/2}})">← Lower Risk</text>`;
  document.getElementById('sla-scatter').innerHTML=
    `<svg viewBox="0 0 ${{W}} ${{H}}" class="svg-chart">${{axes}}${{dots}}</svg>`;
}}

// ── Flow diagram (SVG) ────────────────────────────────────────────────────────
function renderFlow(){{
  const totalW=ANALYTICS.total_workers||512;
  const breachPct=Math.round((ANALYTICS.sla_breach_rate||0)*100);
  const nodes=[
    {{id:'inp',  x:20,  y:115, w:100,h:44, label:'Task Input',    sub:'DB/Telegram/CLI', fill:'#1e3a5f',stroke:'#3b82f6'}},
    {{id:'dec',  x:170, y:115, w:120,h:44, label:'Decision Engine',sub:'Priority + Route', fill:'#312e81',stroke:'#6366f1'}},
    {{id:'alloc',x:340, y:115, w:120,h:44, label:'Worker Alloc',  sub:`${{totalW}} workers`, fill:'#064e3b',stroke:'#10b981'}},
    {{id:'dev',  x:510, y:52,  w:110,h:44, label:'Dev Sandbox',   sub:'Isolated exec',    fill:'#1e3a5f',stroke:'#3b82f6'}},
    {{id:'qa',   x:510, y:115, w:110,h:44, label:'QA Gate',       sub:`Pass: ${{Math.round((ANALYTICS.qa_pass_rate||0)*100)}}%`, fill:'#064e3b',stroke:'#10b981'}},
    {{id:'sla',  x:510, y:178, w:110,h:44, label:'SLA Monitor',   sub:`Breach: ${{breachPct}}%`, fill:breachPct>10?'#7f1d1d':'#1e3a5f', stroke:breachPct>10?'#ef4444':'#3b82f6'}},
    {{id:'rep',  x:670, y:115, w:110,h:44, label:'Report & KPI',  sub:'realtime summary',  fill:'#1e293b',stroke:'#334155'}},
  ];
  const edges=[['inp','dec'],['dec','alloc'],['alloc','dev'],['alloc','qa'],['alloc','sla'],['dev','qa'],['qa','sla'],['sla','rep'],['qa','rep']];
  let svg='';
  edges.forEach(([a,b])=>{{
    const n1=nodes.find(n=>n.id===a), n2=nodes.find(n=>n.id===b);
    const x1=n1.x+n1.w, y1=n1.y+n1.h/2, x2=n2.x, y2=n2.y+n2.h/2;
    const mx=(x1+x2)/2;
    svg+=`<path d="M${{x1}},${{y1}} C${{mx}},${{y1}} ${{mx}},${{y2}} ${{x2}},${{y2}}" fill="none" stroke="#334155" stroke-width="1.5" marker-end="url(#arr)"/>`;
  }});
  nodes.forEach(n=>{{
    svg+=`<rect x="${{n.x}}" y="${{n.y}}" width="${{n.w}}" height="${{n.h}}" fill="${{n.fill}}" rx="7" stroke="${{n.stroke}}" stroke-width="1"/>`;
    svg+=`<text x="${{n.x+n.w/2}}" y="${{n.y+16}}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="600">${{n.label}}</text>`;
    svg+=`<text x="${{n.x+n.w/2}}" y="${{n.y+30}}" text-anchor="middle" fill="#64748b" font-size="9">${{n.sub}}</text>`;
  }});
  document.getElementById('flow-svg').innerHTML=
    `<svg viewBox="0 0 800 270" class="svg-chart">
      <defs><marker id="arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#475569"/></marker></defs>
      ${{svg}}
    </svg>`;
}}

// ── Task table ─────────────────────────────────────────────────────────────────
function pb(p){{const c={{P1:'bp1',P2:'bp2',P3:'bp3'}}[p];return `<span class="b ${{c}}">${{p}}</span>`;}}
function db(s){{const c={{DEV_DONE:'bdo',DEV_RUNNING:'bdr',DEV_FAILED:'bdf'}}[s];return `<span class="b ${{c}}">${{s.replace('DEV_','')}}</span>`;}}
function qb(s){{const c={{QA_PASS:'bqp',QA_FAIL:'bqf',QA_SKIP:'bqs'}}[s];return `<span class="b ${{c}}">${{s.replace('QA_','')}}</span>`;}}

function renderTable(){{
  let rows=TASKS;
  if(fCo) rows=rows.filter(t=>t.company===fCo);
  if(fPr) rows=rows.filter(t=>t.priority===fPr);
  if(fSt) rows=rows.filter(t=>t.dev_status===fSt);
  if(fSr) rows=rows.filter(t=>
    t.task_id.includes(fSr)||t.company.toLowerCase().includes(fSr)||t.assigned_worker.includes(fSr));
  const shown=rows.slice(0,300);
  document.getElementById('task-count').textContent=`${{rows.length.toLocaleString()}} tasks`;
  document.getElementById('task-tbody').innerHTML=shown.map(t=>`<tr>
    <td style="font-family:monospace;color:#60a5fa">${{t.task_id}}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${{t.company}}</td>
    <td>${{pb(t.priority)}}</td>
    <td>${{db(t.dev_status)}}</td>
    <td>${{qb(t.qa_status)}}</td>
    <td style="font-family:monospace;color:#475569">${{t.assigned_worker}}</td>
    <td style="color:#64748b">${{t.duration_h}}h</td>
    <td>${{t.sla_breach?'<span class="b bbr">BREACH</span>':'<span style=color:#334155>OK</span>'}}</td>
  </tr>`).join('');
}}

// ── Filters ────────────────────────────────────────────────────────────────────
function filterCo(c){{
  fCo=fCo===c?null:c;
  const el=document.getElementById('af-co');
  el.style.display=fCo?'inline':'none';
  el.textContent=`Company: ${{fCo}}  ✕`;
  renderTable();
  document.getElementById('sec-tasks').scrollIntoView({{behavior:'smooth'}});
}}
function clearCo(){{fCo=null;filterCo(null);renderTable();}}

function filterPr(p){{
  fPr=fPr===p?null:p;
  document.querySelectorAll('.pb').forEach(b=>b.classList.toggle('on',b.dataset.p===fPr));
  renderTable();
}}
function filterSt(s){{
  fSt=fSt===s?null:s;
  document.querySelectorAll('.sb').forEach(b=>b.classList.toggle('on',b.dataset.s===fSt));
  renderTable();
}}
function onSearch(e){{fSr=e.target.value.trim().toLowerCase();renderTable();}}

function handleFile(e){{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{{
    try{{
      const d=JSON.parse(ev.target.result);
      TASKS.length=0;TASKS.push(...d);
      init();alert(`Loaded ${{d.length}} tasks from ${{f.name}}`);
    }}catch(err){{alert('JSON error: '+err.message);}}
  }};
  r.readAsText(f);
}}

// ── Sidebar KPIs ───────────────────────────────────────────────────────────────
function updateSidebar(){{
  const total=TASKS.length;
  const done=TASKS.filter(t=>t.dev_status==='DEV_DONE').length;
  const breach=TASKS.filter(t=>t.sla_breach).length;
  const active=Object.keys(ANALYTICS.worker_utilization??{{}}).length;
  document.getElementById('sb-total').textContent=total.toLocaleString();
  document.getElementById('sb-done').textContent=pct(done,total)+'%';
  document.getElementById('sb-breach').textContent=breach.toLocaleString();
  document.getElementById('sb-workers').textContent=active.toLocaleString();
}}

// ── Init ───────────────────────────────────────────────────────────────────────
function init(){{
  renderHeatmap();
  renderWorkerBars();
  renderPriorityChart();
  renderSLAScatter();
  renderFlow();
  renderTable();
  updateSidebar();
}}
document.addEventListener('DOMContentLoaded',init);
"""

def build_html(tasks, companies, workers, analytics):
    ts = json.dumps(tasks)
    an = json.dumps(analytics)
    co = json.dumps(companies)

    total  = len(tasks)
    done   = sum(1 for t in tasks if t["dev_status"] == "DEV_DONE")
    breach = sum(1 for t in tasks if t["sla_breach"])
    qa_elig = [t for t in tasks if t["qa_status"] != "QA_SKIP"]
    qa_pass = sum(1 for t in qa_elig if t["qa_status"] == "QA_PASS")
    fail   = sum(1 for t in tasks if t["dev_status"] == "DEV_FAILED")
    running = sum(1 for t in tasks if t["dev_status"] == "DEV_RUNNING")
    gen_at = analytics.get("generated_at", datetime.now().isoformat())[:19].replace("T", " ")

    def pct(n, d): return f"{round(n*100/d)}%" if d else "0%"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Super Agent v2.0 – Digital Twin Dashboard</title>
<style>{_css()}</style>
</head>
<body>
<div id="tooltip"></div>

<!-- Sidebar -->
<aside id="sidebar">
  <div class="logo">Super Agent <span>v2.0</span></div>
  <div class="logo-sub">Digital Twin Dashboard · Offline</div>

  <div class="sb-kpi {'alert' if breach > total * 0.1 else 'warn' if breach > 0 else 'good'}">
    <div class="lb">Total Tasks</div>
    <div class="val" id="sb-total">{total:,}</div>
    <div class="sub">{len(companies)} companies</div>
  </div>
  <div class="sb-kpi good">
    <div class="lb">Completion</div>
    <div class="val" id="sb-done">{pct(done, total)}</div>
    <div class="sub">{done:,} / {total:,} done</div>
  </div>
  <div class="sb-kpi {'alert' if breach > 0 else 'good'}">
    <div class="lb">SLA Breaches</div>
    <div class="val" id="sb-breach">{breach:,}</div>
    <div class="sub">{pct(breach, total)} of tasks</div>
  </div>
  <div class="sb-kpi">
    <div class="lb">Active Workers</div>
    <div class="val" id="sb-workers">{len(workers):,}</div>
    <div class="sub">of {N_WORKERS} pool</div>
  </div>

  <div class="nav-sec">Sections</div>
  <a class="nav-item" href="#sec-kpi">📊 KPI Overview</a>
  <a class="nav-item" href="#sec-heatmap">🟥 Task Heatmap</a>
  <a class="nav-item" href="#sec-workers">👷 Worker Pool</a>
  <a class="nav-item" href="#sec-priority">📈 Priority Breakdown</a>
  <a class="nav-item" href="#sec-sla">⚠ SLA Risk</a>
  <a class="nav-item" href="#sec-flow">🔀 Workflow</a>
  <a class="nav-item" href="#sec-tasks">📋 Task Table</a>

  <div class="nav-sec" style="margin-top:24px">Load Data</div>
  <div style="font-size:10px;color:#475569;margin-bottom:6px">Replace with execution_summary.json</div>
  <input type="file" accept=".json" onchange="handleFile(event)" style="font-size:10px;color:#64748b;width:100%">
</aside>

<!-- Main -->
<main id="main">
  <div class="page-header">
    <h1>Super Agent v2.0 – Digital Twin Dashboard</h1>
    <p>Generated {gen_at} · {total:,} tasks · {len(companies)} companies · {N_WORKERS} worker pool · 100% offline</p>
  </div>

  <!-- KPI -->
  <div class="section" id="sec-kpi">
    <div class="sec-title">KPI Overview</div>
    <div class="cards">
      <div class="card good">
        <div class="lb">Tasks Done</div>
        <div class="val">{pct(done, total)}</div>
        <div class="sub">{done:,} completed</div>
      </div>
      <div class="card {'alert' if fail > total * 0.1 else 'warn' if fail > 0 else 'good'}">
        <div class="lb">Dev Failures</div>
        <div class="val">{pct(fail, total)}</div>
        <div class="sub">{fail:,} tasks</div>
      </div>
      <div class="card">
        <div class="lb">In Progress</div>
        <div class="val">{running:,}</div>
        <div class="sub">{pct(running, total)} of total</div>
      </div>
      <div class="card good">
        <div class="lb">QA Pass Rate</div>
        <div class="val">{pct(qa_pass, len(qa_elig))}</div>
        <div class="sub">{qa_pass:,} / {len(qa_elig):,}</div>
      </div>
      <div class="card {'alert' if breach > total * 0.1 else 'warn' if breach > 0 else 'good'}">
        <div class="lb">SLA Breaches</div>
        <div class="val">{breach:,}</div>
        <div class="sub">{pct(breach, total)} breach rate</div>
      </div>
      <div class="card">
        <div class="lb">Companies</div>
        <div class="val">{len(companies)}</div>
        <div class="sub">active</div>
      </div>
      <div class="card">
        <div class="lb">Worker Pool</div>
        <div class="val">{N_WORKERS}</div>
        <div class="sub">{len(workers):,} assigned</div>
      </div>
    </div>
  </div>

  <!-- Heatmap -->
  <div class="section" id="sec-heatmap">
    <div class="sec-title">Company Task Load &amp; SLA Risk Heatmap
      <span style="font-size:10px;color:#475569;font-weight:400;text-transform:none">
        Color: <span style="color:#10b981">■</span> low risk &nbsp;
        <span style="color:#f97316">■</span> med &nbsp;
        <span style="color:#ef4444">■</span> high breach · Click cell → filter table
      </span>
    </div>
    <div class="panel">
      <div class="heatmap-wrap">
        <div id="heatmap-grid"></div>
      </div>
    </div>
  </div>

  <!-- Workers & Priority -->
  <div class="section" id="sec-workers">
    <div class="sec-title">Worker Allocation &amp; Priority Breakdown</div>
    <div class="two-col">
      <div class="panel">
        <div style="font-size:11px;color:#475569;margin-bottom:10px">Top 24 workers by task count</div>
        <div id="worker-bars"></div>
      </div>
      <div class="panel" id="sec-priority">
        <div style="font-size:11px;color:#475569;margin-bottom:10px">Tasks by priority &amp; dev status</div>
        <div id="priority-chart"></div>
      </div>
    </div>
  </div>

  <!-- SLA scatter -->
  <div class="section" id="sec-sla">
    <div class="sec-title">SLA Risk Matrix
      <span style="font-size:10px;color:#475569;font-weight:400;text-transform:none">
        X = task load · Y = breach rate · Dot size = volume · Click → filter
      </span>
    </div>
    <div class="panel">
      <div id="sla-scatter"></div>
    </div>
  </div>

  <!-- Flow diagram -->
  <div class="section" id="sec-flow">
    <div class="sec-title">Workflow — Task Execution Pipeline</div>
    <div class="panel">
      <div id="flow-svg"></div>
    </div>
  </div>

  <!-- Task table -->
  <div class="section" id="sec-tasks">
    <div class="sec-title">Task Table</div>
    <div class="filter-bar">
      <input type="text" placeholder="Search task ID / company / worker…" oninput="onSearch(event)">
      <span style="font-size:11px;color:#475569">Priority:</span>
      <button class="fb pb" data-p="P1" onclick="filterPr('P1')">P1</button>
      <button class="fb pb" data-p="P2" onclick="filterPr('P2')">P2</button>
      <button class="fb pb" data-p="P3" onclick="filterPr('P3')">P3</button>
      <span style="font-size:11px;color:#475569">Status:</span>
      <button class="fb sb" data-s="DEV_DONE"    onclick="filterSt('DEV_DONE')">Done</button>
      <button class="fb sb" data-s="DEV_RUNNING" onclick="filterSt('DEV_RUNNING')">Running</button>
      <button class="fb sb" data-s="DEV_FAILED"  onclick="filterSt('DEV_FAILED')">Failed</button>
      <span class="active-filter" id="af-co" onclick="clearCo()" style="cursor:pointer"></span>
      <span id="task-count" style="font-size:11px;color:#475569;margin-left:auto"></span>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr>
          <th>Task ID</th><th>Company</th><th>Priority</th>
          <th>Dev Status</th><th>QA</th><th>Worker</th>
          <th>Duration</th><th>SLA</th>
        </tr></thead>
        <tbody id="task-tbody"></tbody>
      </table>
    </div>
    <div style="font-size:10px;color:#334155;margin-top:6px">Showing max 300 rows. Use filters to narrow down.</div>
  </div>

</main>

<script>{_js(ts, an, co)}</script>
</body>
</html>"""

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    tasks, companies, workers, analytics = load_data()
    html = build_html(tasks, companies, workers, analytics)
    BASE_DIR.mkdir(exist_ok=True)
    OUTPUT_HTML.write_text(html, encoding="utf-8")
    size_kb = OUTPUT_HTML.stat().st_size // 1024
    print(f"\n✓ Dashboard generated: {OUTPUT_HTML}")
    print(f"  Size: {size_kb} KB  |  Tasks: {len(tasks):,}  |  Companies: {len(companies)}  |  Workers: {len(workers):,}")
    print(f"\n  Open in browser:")
    print(f"  open {OUTPUT_HTML}")

if __name__ == "__main__":
    main()
