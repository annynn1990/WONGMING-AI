// Server-side chat proxy for Wongming AI.
// Set GROQ_API_KEY in Vercel Environment Variables.
// Optional: GROQ_MODEL (default: llama-3.3-70b-versatile)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'GROQ_API_KEY is not configured' });
    return;
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      res.status(400).json({ error: 'messages is required' });
      return;
    }

    const safeMessages = messages.slice(-12).map((m) => ({
      role: ['system', 'user', 'assistant'].includes(m && m.role) ? m.role : 'user',
      content: String((m && m.content) || '').slice(0, 12000)
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: safeMessages,
        temperature: 0.2,
        max_completion_tokens: 1400,
        stream: false
      })
    });

    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).send(text);
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(text);
  } catch (error) {
    res.status(500).json({ error: String(error && error.message || error) });
  }
}
