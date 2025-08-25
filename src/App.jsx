
import React, { useEffect, useState } from 'react'

const COMPETITIONS = [
  { id: 2014, name: 'LaLiga' },
  { id: 2019, name: 'Serie A' },
  { id: 2021, name: 'Premier League' },
  { id: 2002, name: 'Bundesliga' }
];

function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function pmf(k, l) { if (l <= 0) return k === 0 ? 1 : 0; return Math.exp(-l) * Math.pow(l, k) / factorial(k); }
function scoreMatrix(lh, la, max = 10) {
  const ph = Array.from({ length: max + 1 }, (_, i) => pmf(i, lh));
  const pa = Array.from({ length: max + 1 }, (_, i) => pmf(i, la));
  const M = Array.from({ length: max + 1 }, () => Array(max + 1).fill(0));
  let s = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const v = ph[i] * pa[j];
      M[i][j] = v; s += v;
    }
  }
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      M[i][j] /= s || 1;
    }
  }
  return M;
}
function derive(M) {
  const n = M.length; let pH = 0, pD = 0, pA = 0, ov15 = 0, ov25 = 0, ov35 = 0, btts = 0, h1 = 0, a1 = 0;
  const flat = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = M[i][j];
      flat.push({ i, j, v });
      if (i > j) pH += v; else if (i === j) pD += v; else pA += v;
      const t = i + j;
      if (t >= 2) ov15 += v;
      if (t >= 3) ov25 += v;
      if (t >= 4) ov35 += v;
      if (i >= 1 && j >= 1) btts += v;
      if (i >= 1) h1 += v;
      if (j >= 1) a1 += v;
    }
  }
  flat.sort((a, b) => b.v - a.v);
  const top = flat.slice(0, 5).map(({ i, j, v }) => `${i}-${j} (${v.toFixed(3)})`).join(', ');
  return { pHome: pH, pDraw: pD, pAway: pA, over15: ov15, over25: ov25, over35: ov35, btts, homeG1: h1, awayG1: a1, topScores: top };
}
const fmt = x => (100 * x).toFixed(1) + '%'; const fair = p => p > 0 ? (1 / p).toFixed(2) : '-';

function rowsFromAPIMatches(matches) {
  const out = [];
  for (const m of matches || []) {
    const FTHG = m.score?.fullTime?.home ?? null;
    const FTAG = m.score?.fullTime?.away ?? null;
    if (FTHG == null || FTAG == null) continue;
    out.push({ HomeTeam: m.homeTeam?.name || '', AwayTeam: m.awayTeam?.name || '', FTHG, FTAG });
  }
  return out;
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [comp, setComp] = useState(COMPETITIONS[0].id);
  const [teamQ, setTeamQ] = useState('');
  const [teams, setTeams] = useState([]);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [threshold, setThreshold] = useState(0.8);
  const [resu, setResu] = useState(null);

  const [theDate, setTheDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fixtures, setFixtures] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') { setDark(true); document.documentElement.classList.add('dark'); }
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    if (dark) { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); setDark(false); }
    else { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); setDark(true); }
  }

  async function searchTeams() {
    if (!teamQ) return;
    const r = await fetch(`/api/fd?type=searchTeams&name=${encodeURIComponent(teamQ)}&_=${Date.now()}`);
    const j = await r.json();
    const arr = (j?.teams || []).filter(t => t.runningCompetitions?.some(rc => rc.id === comp));
    setTeams(arr.map(t => ({ id: t.id, name: t.name })));
  }

  async function fetchTeamHistoryByName(name) {
    if (!name) return [];
    let t = teams.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!t) {
      const r = await fetch(`/api/fd?type=searchTeams&name=${encodeURIComponent(name)}&_=${Date.now()}`);
      const j = await r.json();
      const arr = (j?.teams || []).filter(tt => tt.runningCompetitions?.some(rc => rc.id === comp));
      if (!arr.length) return [];
      t = { id: arr[0].id, name: arr[0].name };
    }
    const now = new Date(); const from = new Date(now); from.setFullYear(now.getFullYear() - 3);
    const r2 = await fetch(`/api/fd?type=teamMatches&teamId=${t.id}&status=FINISHED&dateFrom=${from.toISOString().slice(0, 10)}&dateTo=${now.toISOString().slice(0, 10)}&_=${Date.now()}`);
    const j2 = await r2.json();
    return rowsFromAPIMatches(j2?.matches || []);
  }

  async function analyze() {
    if (!home || !away) { alert('Selecciona Local y Visitante'); return; }
    const [Rh, Ra] = await Promise.all([fetchTeamHistoryByName(home), fetchTeamHistoryByName(away)]);
    const hist = [...Rh, ...Ra]; if (hist.length < 10) alert('La API devolvió pocos partidos para estos equipos.');
    const muHome = hist.reduce((s, r) => s + r.FTHG, 0) / hist.length || 1;
    const muAway = hist.reduce((s, r) => s + r.FTAG, 0) / hist.length || 1;
    const set = new Set(); hist.forEach(r => { set.add(r.HomeTeam); set.add(r.AwayTeam); });
    const init = () => ({ m: 0, gf: 0, ga: 0 }); const map = new Map(); [...set].forEach(t => map.set(t, init()));
    for (const r of hist) {
      const TH = map.get(r.HomeTeam); TH.m++; TH.gf += r.FTHG; TH.ga += r.FTAG;
      const TA = map.get(r.AwayTeam); TA.m++; TA.gf += r.FTAG; TA.ga += r.FTHG;
    }
    const g = t => map.get(t) || init();
    const att_h = (g(home).gf / (g(home).m || 1)) / (((muHome + muAway) / 2) || 1);
    const def_a = (g(away).ga / (g(away).m || 1)) / (((muHome + muAway) / 2) || 1);
    const att_a = (g(away).gf / (g(away).m || 1)) / (((muHome + muAway) / 2) || 1);
    const def_h = (g(home).ga / (g(home).m || 1)) / (((muHome + muAway) / 2) || 1);
    const lambdaHome = Math.max(0.05, Math.min(5, muHome * att_h * def_a));
    const lambdaAway = Math.max(0.05, Math.min(5, muAway * att_a * def_h));
    const M = scoreMatrix(lambdaHome, lambdaAway, 10); const mk = derive(M);
    const entries = [
      ['1 (Local)', mk.pHome], ['X (Empate)', mk.pDraw], ['2 (Visitante)', mk.pAway],
      ['Over 1.5', mk.over15], ['Over 2.5', mk.over25], ['Over 3.5', mk.over35],
      ['BTTS', mk.btts], ['Local ≥1', mk.homeG1], ['Visitante ≥1', mk.awayG1]
    ];
    const strong = entries.filter(([, p]) => p >= threshold).sort((a, b) => b[1] - a[1]);
    setResu({ home, away, lambdas: { lambdaHome, lambdaAway }, markets: mk, strong, threshold });
  }

  async function loadFixtures() {
    const comps = COMPETITIONS;
    const promises = comps.map(async c => {
      const r = await fetch(`/api/fd?type=competitionMatches&competitionId=${c.id}&status=SCHEDULED&dateFrom=${theDate}&dateTo=${theDate}&_=${Date.now()}`);
      const j = await r.json();
      const matches = (j?.matches || []).map(m => ({ home: m.homeTeam?.name || '-', away: m.awayTeam?.name || '-', utcDate: m.utcDate || '' }));
      return { competitionId: c.id, competitionName: c.name, matches };
    });
    setFixtures(await Promise.all(promises));
  }

  function loadToday() {
    const today = new Date().toISOString().slice(0, 10);
    setTheDate(today);
    (async () => {
      const comps = COMPETITIONS;
      const promises = comps.map(async c => {
        const r = await fetch(`/api/fd?type=competitionMatches&competitionId=${c.id}&status=SCHEDULED&dateFrom=${today}&dateTo=${today}&_=${Date.now()}`);
        const j = await r.json();
        const matches = (j?.matches || []).map(m => ({ home: m.homeTeam?.name || '-', away: m.awayTeam?.name || '-', utcDate: m.utcDate || '' }));
        return { competitionId: c.id, competitionName: c.name, matches };
      });
      setFixtures(await Promise.all(promises));
    })();
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="h1">⚽ Analizador — API Pura</div>
        <button className="toggle" onClick={toggleTheme}>{dark ? '☀️ Claro' : '🌙 Oscuro'}</button>
      </div>
      <div className="sub">Datos en vivo desde football-data.org.</div>

      <div className="grid">
        <div className="card">
          <div className="sub"><b>Partidos del día</b></div>
          <div className="actionRow">
            <input type="date" value={theDate} onChange={e => setTheDate(e.target.value)} />
            <button onClick={loadFixtures}>Cargar partidos</button>
            <button onClick={loadToday}>Partidos de hoy</button>
          </div>
          <div className="fixtures" style={{ marginTop: 8 }}>
            {fixtures.map(section => (
              <div key={section.competitionId} className="card">
                <div className="leagueTag">{section.competitionName}</div>
                {!section.matches.length && <div className="badge">Sin partidos programados</div>}
                {section.matches.map((m, idx) => (
                  <div key={idx} className="fixture">
                    <div>{m.home} vs {m.away}</div>
                    <div className="badge">{m.utcDate?.slice(11, 16)} UTC</div>
                    <button onClick={() => { setComp(section.competitionId); setHome(m.home); setAway(m.away); setResu(null); }}>Analizar</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="sub">1) Liga</div>
          <select value={comp} onChange={e => setComp(parseInt(e.target.value, 10))}>
            {COMPETITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="sub">2) Buscar equipos</div>
          <div className="row row-2">
            <input placeholder="Escribe nombre (ej. Madrid)" value={teamQ} onChange={e => setTeamQ(e.target.value)} />
            <button onClick={searchTeams}>Buscar</button>
          </div>
          {!!teams.length && <div className="sub">Resultados: {teams.map(t => t.name).slice(0, 8).join(' • ')}</div>}
        </div>

        <div className="card">
          <div className="sub">3) Seleccionar partido</div>
          <div className="row row-2">
            <input list="list" placeholder="Local" value={home} onChange={e => setHome(e.target.value)} />
            <input list="list" placeholder="Visitante" value={away} onChange={e => setAway(e.target.value)} />
          </div>
          <datalist id="list">{teams.map(t => <option key={t.id} value={t.name} />)}</datalist>
        </div>

        <div className="card">
          <div className="sub">4) Umbral probabilidad</div>
          <input type="range" min={0.5} max={0.95} step={0.01} value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} />
          <div className="badge"><b>{(threshold * 100).toFixed(0)}%</b></div>
        </div>

        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="sub">Analizar partido</div>
          <button onClick={analyze}>Analizar</button>
        </div>

        {resu && <div className="grid">
          <div className="card">
            <div className="sub"><b>Resumen</b></div>
            <div className="kpi">λ Local: <b>{resu.lambdas.lambdaHome.toFixed(2)}</b></div>
            <div className="kpi">λ Visitante: <b>{resu.lambdas.lambdaAway.toFixed(2)}</b></div>
            <div className="kpi">Top marcadores: <b>{resu.markets.topScores}</b></div>
          </div>
          <div className="card">
            <div className="sub"><b>Probabilidades</b></div>
            <div className="kpi">1 (Local): <b>{fmt(resu.markets.pHome)}</b> <span className="badge">(cuota {fair(resu.markets.pHome)})</span></div>
            <div className="kpi">X (Empate): <b>{fmt(resu.markets.pDraw)}</b> <span className="badge">(cuota {fair(resu.markets.pDraw)})</span></div>
            <div className="kpi">2 (Visitante): <b>{fmt(resu.markets.pAway)}</b> <span className="badge">(cuota {fair(resu.markets.pAway)})</span></div>
            <div className="kpi">Over 1.5: <b>{fmt(resu.markets.over15)}</b></div>
            <div className="kpi">Over 2.5: <b>{fmt(resu.markets.over25)}</b></div>
            <div className="kpi">Over 3.5: <b>{fmt(resu.markets.over35)}</b></div>
            <div className="kpi">BTTS: <b>{fmt(resu.markets.btts)}</b></div>
            <div className="kpi">Local ≥1: <b>{fmt(resu.markets.homeG1)}</b></div>
            <div className="kpi">Visitante ≥1: <b>{fmt(resu.markets.awayG1)}</b></div>
          </div>
          <div className="card">
            <div className="sub"><b>✅ Eventos ≥ {(resu.threshold * 100).toFixed(0)}%</b></div>
            {resu.strong.length ? <ul>{resu.strong.map(([n, p]) => <li key={n}>{n}: <b>{fmt(p)}</b> <span className="badge">(cuota {fair(p)})</span></li>)} </ul> : <div className="badge">Ningún evento supera el umbral.</div>}
          </div>
        </
