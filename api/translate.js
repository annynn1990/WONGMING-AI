// Public translation proxy for Wongming guide.
// No GROQ_API_KEY or user-provided API key is required.
// Best-effort per-instance throttling helps stop accidental loops and simple abuse.
// For hard cross-instance limits, configure Vercel Firewall/Spend Management.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;
const requestHits = new Map();

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || String(req.headers['x-real-ip'] || '').trim()
    || 'unknown';
}

function isRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = requestHits.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + RATE_WINDOW_MS };
    requestHits.set(ip, entry);
  }
  entry.count++;
  if (requestHits.size > 5000) {
    for (const [key, value] of requestHits) {
      if (now > value.reset) requestHits.delete(key);
    }
  }
  return entry.count > RATE_LIMIT;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate limited. Please retry in 60 seconds.' });
  }

  const body = req.body || {};
  const target = String(body.target || 'en');
  const items = Array.isArray(body.items) ? body.items : [];
  const allowed = new Set(['zh-Hant','zh-Hans','en','ja','ko']);
  if (!allowed.has(target)) return res.status(400).json({ error: 'Unsupported target language' });
  if (!items.length || items.length > 25) return res.status(400).json({ error: 'items must contain 1-25 strings' });

  const targetCode = { 'zh-Hant':'zh-TW', 'zh-Hans':'zh-CN', en:'en', ja:'ja', ko:'ko' }[target];
  const clean = items.map((x) => String(x || '').slice(0, 900));

  try {
    const translations = await Promise.all(clean.map(async (text) => {
      if (!text.trim()) return text;
      const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(targetCode) + '&dt=t&q=' + encodeURIComponent(text);
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error('public translator HTTP ' + response.status);
      const data = await response.json();
      const parts = Array.isArray(data && data[0]) ? data[0] : [];
      const translated = parts.map((part) => Array.isArray(part) ? String(part[0] || '') : '').join('');
      return translated || text;
    }));
    return res.status(200).json({ translations });
  } catch (error) {
    return res.status(502).json({ error: String(error && error.message || error) });
  }
}
