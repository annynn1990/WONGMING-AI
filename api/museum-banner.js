const SOURCE="https://www.wongmingempire.com/bbswm/data/attachment/common/03/common_195_banner.jpg";

export default async function handler(req,res){
  try{
    const upstream=await fetch(SOURCE,{
      headers:{
        "User-Agent":"Mozilla/5.0 (compatible; Wongming-Museum/1.0)",
        "Referer":"https://www.wongmingempire.com/bbswm/"
      }
    });
    if(!upstream.ok) return res.status(upstream.status).send("Banner unavailable");
    const type=upstream.headers.get("content-type")||"image/jpeg";
    const body=Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type",type);
    res.setHeader("Cache-Control","public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    return res.status(200).send(body);
  }catch(err){
    return res.status(502).send("Banner fetch failed");
  }
}
