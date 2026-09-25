export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.query && req.query.shrine === '1') {
    const REPO = 'annynn1990/WONGMING-AI';
    const PATH = 'data/shrine-lamps.json';
    const GH = 'https://api.github.com';
    try {
      const { getToken } = await import('@vercel/connect');
      const token = await getToken('github/wongming-github', { subject: { type: 'app' } });
      if (!token) return res.status(500).json({ok:false,message:'服務尚未完成設定'});
      const headers = {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'};
      const url = GH + '/repos/' + REPO + '/contents/' + PATH + '?ref=main';
      if (req.method === 'GET') {
        const r = await fetch(url, {headers});
        if (!r.ok) throw new Error('讀取失敗');
        const f = await r.json();
        return res.status(200).json(JSON.parse(Buffer.from(f.content,'base64').toString('utf8')));
      }
      if (req.method === 'POST') {
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!Array.isArray(data) || data.length !== 80) return res.status(400).json({ok:false,message:'資料格式錯誤'});
        const current = await fetch(url,{headers});
        if (!current.ok) throw new Error('讀取版本失敗');
        const f = await current.json();
        const content = Buffer.from(JSON.stringify(data,null,2)+'\n').toString('base64');
        const r = await fetch(GH + '/repos/' + REPO + '/contents/' + PATH,{method:'PUT',headers,body:JSON.stringify({message:'更新燈牆資料',content,sha:f.sha,branch:'main'})});
        if (!r.ok) throw new Error('儲存失敗');
        return res.status(200).json({ok:true});
      }
      return res.status(405).json({ok:false,message:'不支援的操作'});
    } catch(e) { console.error(e); return res.status(500).json({ok:false,message:'同步服務發生錯誤'}); }
  }

  const country = String(req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').toUpperCase();
  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  let language = '';
  if (country === 'TW' || country === 'HK' || country === 'MO') language = 'zh-Hant';
  else if (country === 'CN' || country === 'SG') language = /^zh-(tw|hk|mo)/i.test(accept) ? 'zh-Hant' : 'zh-Hans';
  else if (country === 'JP') language = 'ja';
  else if (country === 'KR') language = 'ko';
  else if (country) language = 'en';
  if (!language) {
    if (accept.includes('zh-tw') || accept.includes('zh-hant') || accept.includes('zh-hk') || accept.includes('zh-mo')) language = 'zh-Hant';
    else if (accept.includes('zh')) language = 'zh-Hans';
    else if (accept.includes('ja')) language = 'ja';
    else if (accept.includes('ko')) language = 'ko';
    else language = 'en';
  }
  res.status(200).json({country:country || null,language});
}