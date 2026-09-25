(function(){
'use strict';

var API='https://wongming-ai.vercel.app';
var originals=new Map();
var active='';
var manualKey='wm_site_language_manual';

function getManual(){
  try{
    var v=localStorage.getItem(manualKey)||'';
    return ['zh-Hant','zh-Hans','en','ja','ko'].indexOf(v)>=0?v:'';
  }catch(e){return '';}
}
function saveManual(v){
  try{
    localStorage.setItem(manualKey,v);
    localStorage.removeItem('wm_site_language');
  }catch(e){}
}
function mapCountry(country){
  country=String(country||'').toUpperCase();
  if(country==='TW'||country==='HK'||country==='MO') return 'zh-Hant';
  if(country==='CN'||country==='SG') return 'zh-Hans';
  if(country==='JP') return 'ja';
  if(country==='KR') return 'ko';
  if(country) return 'en';
  return '';
}
async function detectAuto(){
  try{
    var r=await fetch(API+'/api/locale',{cache:'no-store'});
    if(r.ok){
      var j=await r.json();
      if(['zh-Hant','zh-Hans','en','ja','ko'].indexOf(j.language)>=0)return j.language;
    }
  }catch(e){}
  try{
    var r2=await fetch('https://ipapi.co/json/',{cache:'no-store'});
    if(r2.ok){
      var j2=await r2.json();
      var byCountry=mapCountry(j2.country_code||j2.country);
      if(byCountry)return byCountry;
    }
  }catch(e){}
  var l=(navigator.language||'').toLowerCase();
  return l.indexOf('zh-tw')===0||l.indexOf('zh-hk')===0||l.indexOf('zh-mo')===0||l.indexOf('zh-hant')===0?'zh-Hant':
    l.indexOf('zh')===0?'zh-Hans':
    l.indexOf('ja')===0?'ja':
    l.indexOf('ko')===0?'ko':'en';
}
function collect(){
  var a=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    var n=w.currentNode,p=n.parentElement;
    if(!p||p.closest('#avatar-widget-root,script,style,noscript,textarea,input,select,option,button'))continue;
    var t=(n.nodeValue||'').replace(/\s+/g,' ').trim();
    if(t.length>1&&/[\u3400-\u9fff]/.test(t))a.push({n:n,t:t});
  }
  return a;
}
function restore(){
  originals.forEach(function(v,n){try{n.nodeValue=v;}catch(e){}});
  originals.clear();
  active='';
}
async function translatePage(target,manual){
  if(['zh-Hant','zh-Hans','en','ja','ko'].indexOf(target)<0)return;
  if(manual)saveManual(target);
  if(target==='zh-Hant'){restore();return;}
  if(active===target)return;

  restore();
  var nodes=collect();
  if(!nodes.length)return;
  nodes.forEach(function(x){originals.set(x.n,x.n.nodeValue);});

  try{
    for(var i=0;i<nodes.length;i+=25){
      var r=await fetch(API+'/api/translate',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          target:target,
          items:nodes.slice(i,i+25).map(function(x){return x.t;})
        })
      });
      if(!r.ok)throw new Error('translation '+r.status);
      var j=await r.json();
      var a=Array.isArray(j.translations)?j.translations:[];
      if(a.length!==Math.min(25,nodes.length-i))throw new Error('translation length mismatch');
      a.forEach(function(v,k){
        if(nodes[i+k])nodes[i+k].n.nodeValue=String(v);
      });
    }
    active=target;
  }catch(e){
    restore();
    console.warn('[Wongming translation]',e);
  }
}

window.__WM_TRANSLATE_PAGE__=function(target){
  return translatePage(String(target||'en'),true);
};

async function autoApply(){
  if(getManual())return;
  var target=await detectAuto();
  if(target&&target!=='zh-Hant')await translatePage(target,false);
}

function boot(){setTimeout(autoApply,700);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();