// Detect a coarse visitor locale from Vercel's edge country header and the browser language.
// Country is used only to choose a default language; no visitor profile is stored.
export default function handler(req, res) {
  const country = String(
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    ''
  ).toUpperCase();

  const accept = String(req.headers['accept-language'] || '').toLowerCase();

  let language = '';
  if (country === 'TW' || country === 'HK' || country === 'MO') language = 'zh-Hant';
  else if (country === 'CN' || country === 'SG') {
    language = /^zh-(tw|hk|mo)/i.test(accept) ? 'zh-Hant' : 'zh-Hans';
  } else if (country === 'JP') language = 'ja';
  else if (country === 'KR') language = 'ko';
  else if (country) language = 'en';

  if (!language) {
    if (accept.includes('zh-tw') || accept.includes('zh-hant') || accept.includes('zh-hk') || accept.includes('zh-mo')) language = 'zh-Hant';
    else if (accept.includes('zh')) language = 'zh-Hans';
    else if (accept.includes('ja')) language = 'ja';
    else if (accept.includes('ko')) language = 'ko';
    else language = 'en';
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ country: country || null, language });
}
