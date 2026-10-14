/* Azure AI Speech Neural TTS endpoint for Wongming Avatar.
 * Secrets stay server-side in Vercel environment variables:
 *   AZURE_SPEECH_KEY
 *   AZURE_SPEECH_REGION (the region of the Speech resource, e.g. eastasia)
 */
const VOICES = new Set([
  'zh-TW-HsiaoChenNeural',
  'zh-TW-HsiaoYuNeural',
  'zh-TW-YunJheNeural',
  'zh-CN-XiaoxiaoNeural',
  'en-US-AriaNeural',
  'ja-JP-NanamiNeural',
  'ko-KR-SunHiNeural',
]);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hostOf(value) {
  try { return new URL(value).host.toLowerCase(); }
  catch (_) { return ''; }
}

function isAllowed(req) {
  const self = String(req.headers.host || '').toLowerCase();
  const extra = String(process.env.TTS_ALLOWED_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const allowedHosts = new Set([self, ...extra]);
  const sources = [req.headers.referer, req.headers.origin].filter(Boolean);
  if (!sources.length) return false;
  return sources.some(source => {
    const host = hostOf(source);
    if (allowedHosts.has(host)) return true;
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  });
}

const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 30;
const hits = new Map();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress)
    || 'unknown';
}

function rateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  let entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + RL_WINDOW_MS };
    hits.set(ip, entry);
  }
  entry.count += 1;
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (now > value.reset) hits.delete(key);
    }
  }
  return entry.count > RL_MAX;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('method not allowed');
    return;
  }

  try {
    if (!isAllowed(req)) {
      res.statusCode = 403;
      res.end('forbidden: bad origin');
      return;
    }
    if (rateLimited(req)) {
      res.setHeader('Retry-After', '60');
      res.statusCode = 429;
      res.end('rate limited');
      return;
    }

    const key = String(process.env.AZURE_SPEECH_KEY || '').trim();
    const region = String(process.env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
    if (!key || !region || !/^[a-z0-9-]+$/.test(region)) {
      res.statusCode = 503;
      res.end('speech service not configured');
      return;
    }

    const url = new URL(req.url, 'https://localhost');
    const text = String(url.searchParams.get('text') || '').slice(0, 600).trim();
    let voice = String(url.searchParams.get('voice') || 'zh-TW-HsiaoChenNeural');
    if (!VOICES.has(voice)) voice = 'zh-TW-HsiaoChenNeural';
    if (!text) {
      res.statusCode = 400;
      res.end('missing text');
      return;
    }

    const locale = voice.slice(0, 5);
    const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let upstream;
    try {
      upstream = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'Wongming-AI-Avatar',
          },
          body: ssml,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      console.error('[Wongming TTS] Azure Speech returned HTTP', upstream.status);
      res.statusCode = 502;
      res.end('speech provider error');
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (audio.length < 800) {
      res.statusCode = 502;
      res.end('speech audio unavailable');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.end(audio);
  } catch (error) {
    console.error('[Wongming TTS] synthesis failed:', error && error.name || 'unknown');
    res.statusCode = 502;
    res.end('speech synthesis failed');
  }
};
