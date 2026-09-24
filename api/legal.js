const LAW_SOURCES = [
["第二章《國旗國徽及國歌條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26410"],
["第十五章《首相副相宣誓條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26430"],
["第十八章《皇室典範》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26433"],
["第二十章《社團註冊法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26435"],
["第二十三章《內閣法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26438"],
["第三十八章《人權法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26453"],
["第四十五章《帝國國民身份條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26460"],
["第五十二章《政黨法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26467"],
["第五十四章《皇位事務條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26469"],
["第五十七章《地方行政法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26472"],
["第六十二章《國會選舉法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=31567&extra=page%3D2"],
["第六十九章《內閣總理大臣產生條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=35274&extra=page%3D2"],
["第一章《康樂組織及行程條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26409"],
["第三章《半官方機構條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26412"],
["第二十四章《中央銀行法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26439"],
["第三十六章《帝國國會法》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26451"],
["第三十七章《帝國法庭條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26452"],
["第四十章《監獄條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26455"],
["第十四章《首都論壇帖務條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26429"],
["第二十九章《保密通訊條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26444"],
["第三十條《刑事條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26445"],
["第四十八章《誹謗條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26463"],
["第二十五章《國家假期及國曆使用條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26440"],
["第三十一章《債務及破產條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=26446"],
["第六十五章《土地業權及交易條例》","https://www.wongmingempire.com/bbswm/forum.php?mod=viewthread&tid=28680"]
];

function strip(html){
  return String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function score(q, title, text){
  const words=String(q).toLowerCase().split(/[\s，。！？、；：,.!?;:]+/).filter(x=>x.length>1);
  const hay=(title+' '+text).toLowerCase();
  return words.reduce((n,w)=>n+(hay.includes(w)?2:0),0);
}
async function get(url){
  const r=await fetch(url,{headers:{'User-Agent':'Wongming-AI-Legal-Reader/1.0'},signal:AbortSignal.timeout(8000)});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.text();
}
function linksFromBoard(html){
  const out=[], seen=new Set(), re=/<a[^>]+href=["']([^"']*(?:mod=viewthread|tid=)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))){
    let u=m[1].replace(/&amp;/g,'&'); if(u.startsWith('/')) u='https://www.wongmingempire.com'+u;
    if(!/^https?:\/\//.test(u)||!/bbswm/.test(u)) continue;
    const tid=(u.match(/[?&]tid=(\d+)/)||[])[1]; if(!tid||seen.has(tid)) continue;
    seen.add(tid); out.push({url:u,title:strip(m[2])});
  }
  return out;
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.GROQ_API_KEY;
  if(!key) return res.status(503).json({error:'GROQ_API_KEY is not configured'});
  try{
    const q=String((req.body||{}).query||'').trim();
    if(!q) return res.status(400).json({error:'query is required'});
    const board=[];
    for(let p=1;p<=3;p++){
      try{ board.push(...linksFromBoard(await get('https://www.wongmingempire.com/bbswm/forum.php?fid=45&mod=forumdisplay&page='+p))); }catch(e){}
    }
    const candidates=LAW_SOURCES.map(x=>({title:x[0],url:x[1],seed:true}))
      .concat(board.map(x=>({...x,seed:false})));
    const unique=[]; const seen=new Set();
    for(const x of candidates){ if(!seen.has(x.url)){seen.add(x.url);unique.push(x);} }
    unique.sort((a,b)=>score(q,b.title,b.title)-score(q,a.title,a.title));
    const picked=unique.slice(0,7);
    const docs=[];
    for(const x of picked){
      try{
        const html=await get(x.url);
        const text=strip(html).slice(0,9000);
        docs.push({title:x.title,url:x.url,text});
      }catch(e){}
    }
    const corpus=docs.map((d,i)=>'【來源'+(i+1)+'】 '+d.title+'\nURL: '+d.url+'\n內容: '+d.text).join('\n\n');
    const system='你是黃名帝國法律資源中心的 AI 法律導覽員。這是一個虛構／網站內部法制體系的資訊服務，不要拿現實世界法律替代它。你的回答必須以提供的黃名帝國論壇原文為依據。先用自然、人性化的方式直接回答使用者真正想知道的事情；如果資料不足，要明確說資料不足，不得編造法條。回答可以把艱深條文翻成白話，但不得改變條文意思。若能確認法源，最後列出「法源依據」與原文連結。不要每次都用制式官腔，也不要要求使用者一定使用特定格式。若使用者只是問一般聊天，正常回答即可。\n\n法律資料：\n'+corpus;
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile',messages:[{role:'system',content:system},{role:'user',content:q}],temperature:.2,max_completion_tokens:1200})});
    const j=await r.json();
    if(!r.ok) return res.status(r.status).json(j);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.status(200).json({answer:j.choices?.[0]?.message?.content||'目前找不到足夠的法律資料。',sources:docs.map(d=>({title:d.title,url:d.url}))});
  }catch(e){res.status(500).json({error:String(e.message||e)});}
}
