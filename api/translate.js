// Public translation proxy for Wongming guide.
// No GROQ_API_KEY or user-provided API key is required.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
