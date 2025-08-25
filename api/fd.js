export default async function handler(req, res) {
  // 🚫 No cachear en navegador ni CDN
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Evitar cache de Vercel CDN
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return res.status(500).json({ error: 'FOOTBALL_DATA_TOKEN no está configurado' });

  const { type, name, teamId, competitionId, dateFrom, dateTo, status, season, _ } = req.query;
  const base = 'https://api.football-data.org/v4';
  const headers = { 'X-Auth-Token': token };

  try {
    if (type === 'searchTeams' && name) {
      const r = await fetch(`${base}/teams?name=${encodeURIComponent(name)}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'teamMatches' && teamId) {
      const params = new URLSearchParams();
      if (status) params.set('status', status);           // FINISHED para histórico
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (season) params.set('season', season);
      // 👇 cache-buster hacia la API origen (por si su CDN cachea)
      params.set('_', Date.now().toString());

      const r = await fetch(`${base}/teams/${teamId}/matches?${params.toString()}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'competitionMatches' && competitionId) {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);     // YYYY-MM-DD
      if (dateTo) params.set('dateTo', dateTo);
      if (status) params.set('status', status);           // SCHEDULED para “del día”
      params.set('_', Date.now().toString());             // cache-buster

      const r = await fetch(`${base}/competitions/${competitionId}/matches?${params.toString()}`, { headers });
      return res.status(200).json(await r.json());
    }

    if (type === 'competitionTeams' && competitionId) {
      const r = await fetch(`${base}/competitions/${competitionId}/teams`, { headers });
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: 'Parámetros inválidos' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error inesperado' });
  }
}
