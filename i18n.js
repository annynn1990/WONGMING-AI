(function(){
'use strict';
var API='https://wongming-ai.vercel.app';
var LANG={'zh-Hant':'繁體中文','zh-Hans':'简体中文','en':'English','ja':'日本語','ko':'한국어'};
var state={language:'zh-Hant',country:'',ready:false};
var cache=new Map();

async function detect(){
  try{
    var r=await fetch(API+'/api/locale',{cache:'no-store'});
    if(r.ok){var j=await r.json(); if(LANG[j.language]){state.language=j.language;state.country=j.country||'';return;}}
  }catch(e){}
  var l=(navigator.language||'').toLowerCase();
  state.language=l.indexOf('zh-tw')===0||l.indexOf('zh-hant')===0?'zh-Hant':l.indexOf('zh')===0?'zh-Hans':l.indexOf('ja')===0?'ja':l.indexOf('ko')===0?'ko':'en';
}
async function translate(text){
  if(!text)return text;
  if(!state.ready){try{await state.promise;}catch(e){}}
  if(state.language==='zh-Hant')return text;
  var key=state.language+'|'+text;
  if(cache.has(key))return cache.get(key);
  try{
    var r=await fetch(API+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:state.language,items:[String(text).slice(0,900)]})});
    if(!r.ok)return text;
    var j=await r.json(),out=j.translations&&j.translations[0]?String(j.translations[0]):text;
    cache.set(key,out);return out;
  }catch(e){return text;}
}
state.promise=detect();
window.WM_I18N={
  getLanguage:function(){return state.language;},getVoice:function(){return {'zh-Hant':'zh-TW-HsiaoChenNeural','zh-Hans':'zh-CN-XiaoxiaoNeural','en':'en-US-AriaNeural','ja':'ja-JP-NanamiNeural','ko':'ko-KR-SunHiNeural'}[state.language]||'zh-TW-HsiaoChenNeural';},
  localize:translate,
  openMenu:function(){
    var box=document.getElementById('suggestions');if(!box)return;
    box.innerHTML='';
    [['English','en'],['日本語','ja'],['한국어','ko'],['简体中文','zh-Hans'],['恢復中文','zh-Hant']].forEach(function(x){
      var b=document.createElement('button');b.className='sugg';b.textContent=x[0];
      b.onclick=function(){
        box.innerHTML='';
        try{window.parent.postMessage({ns:'avatar-widget',type:'action',action:{action:'translate',target:x[1]}},'https://wongming-ai.vercel.app');}catch(e){}
        if(typeof window.showBubble==='function')window.showBubble(x[1]==='zh-Hant'?'已恢復中文原文。':'正在翻譯目前頁面成 '+x[0]+'……');
      };box.appendChild(b);
    });
  }
};
state.promise.then(function(){
  var b=document.getElementById('btn-llm');
  if(b){b.textContent='🌐';b.setAttribute('aria-label','翻譯目前頁面');b.title='翻譯目前頁面｜導覽語言：'+LANG[state.language];b.onclick=window.WM_I18N.openMenu;}
  state.ready=true;
  window.parent.postMessage({ns:'avatar-widget',type:'visitor-locale',language:state.language,country:state.country},'https://wongming-ai.vercel.app');
});
})();