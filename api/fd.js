
// /api/fd.js
export default async function handler(req, res) {
  // No cache (navegador + CDN)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return res.status(500).json({ error: 'FOOTBALL_DATA_TOKEN no está configurado' });

  const { type, name, teamId, competitionId, dateFrom, dateTo, status, season } = req.query;
  const base = 'https://api.football-data.org/v4';
  const headers = { 'X-Auth-Token': token };

  try {
    if (type === 'searchTeams' && name) {
      const r = await fetch(`${base}/teams?name=${encodeURIComponent(name)}&_=${Date.now()}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'teamMatches' && teamId) {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (season) p.set('season', season);
      p.set('_', Date.now().toString());
      const r = await fetch(`${base}/teams/${teamId}/matches?${p.toString()}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'competitionTeams' && competitionId) {
      const r = await fetch(`${base}/competitions/${competitionId}/teams?_=${Date.now()}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'competitionMatches' && competitionId) {
      const p = new URLSearchParams();
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (status) p.set('status', status);
      if (season) p.set('season', season); // 👈 importante para el fallback por temporada
      p.set('_', Date.now().toString());
      const r = await fetch(`${base}/competitions/${competitionId}/matches?${p.toString()}`, { headers });
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: 'Parámetros inválidos' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error inesperado' });
  }
}
