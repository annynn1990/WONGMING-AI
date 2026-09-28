// 皇家音樂廳雲端曲目 API：Vercel -> GitHub JSON，前端不保存資料。
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS') return res.status(204).end();
  const REPO='annynn1990/WONGMING-AI', PATH='data/music-hall.json', GH='https://api.github.com';
  try{
    const token=process.env.GITHUB_TOKEN;
    if(!token) return res.status(500).json({ok:false,message:'尚未設定雲端儲存憑證'});
    const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
    const url=GH+'/repos/'+REPO+'/contents/'+PATH+'?ref=main';
    const current=await fetch(url,{headers});
    if(!current.ok) return res.status(502).json({ok:false,message:'GitHub 讀取失敗',code:current.status});
    const file=await current.json();
    if(req.method==='GET') return res.status(200).json(JSON.parse(Buffer.from(file.content,'base64').toString('utf8')));
    if(req.method==='POST'){
      const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
      if(!Array.isArray(data)||data.length>200) return res.status(400).json({ok:false,message:'資料格式錯誤'});
      for(const x of data){if(!x||typeof x.title!=='string'||typeof x.youtube!=='string') return res.status(400).json({ok:false,message:'曲目格式錯誤'});}
      const encoded=Buffer.from(JSON.stringify(data,null,2)+'\\n').toString('base64');
      const r=await fetch(GH+'/repos/'+REPO+'/contents/'+PATH,{method:'PUT',headers,body:JSON.stringify({message:'更新皇家音樂廳曲目',content:encoded,sha:file.sha,branch:'main'})});
      if(!r.ok) return res.status(502).json({ok:false,message:'GitHub 儲存失敗',code:r.status});
      return res.status(200).json({ok:true,data});
    }
    return res.status(405).json({ok:false,message:'不支援的操作'});
  }catch(e){return res.status(500).json({ok:false,message:'同步服務發生錯誤'});}
}