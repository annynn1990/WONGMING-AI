// Translate batches of page text for the Wongming guide.
// Requires GROQ_API_KEY in Vercel Environment Variables.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'GROQ_API_KEY is not configured' });

  const body = req.body || {};
  const target = String(body.target || 'en');
  const items = Array.isArray(body.items) ? body.items : [];
  const allowed = new Set(['zh-Hant','zh-Hans','en','ja','ko']);
  if (!allowed.has(target)) return res.status(400).json({ error: 'Unsupported target language' });
  if (!items.length || items.length > 40) return res.status(400).json({ error: 'items must contain 1-40 strings' });

  const names = {
    'zh-Hant': 'Traditional Chinese',
    'zh-Hans': 'Simplified Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean'
  };

  const clean = items.map((x) => String(x || '').slice(0, 900));
  const payload = JSON.stringify(clean);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: process.env.GROQ_TRANSLATE_MODEL || 'openai/gpt-oss-120b',
        temperature: 0,
        max_completion_tokens: 6000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a careful website translator. Translate each string into ' + names[target] +
              '. Return ONLY a JSON object with a "translations" array of exactly the same length and order as the input. ' +
              'Preserve URLs, numbers, names, forum identifiers, punctuation, and line breaks when they carry meaning. ' +
              'Do not add commentary. Do not translate code or HTML.'
          },
          { role: 'user', content: payload }
        ]
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(response.status).send(raw);
    }

    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    const translations = Array.isArray(parsed.translations) ? parsed.translations : [];

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ translations });
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
