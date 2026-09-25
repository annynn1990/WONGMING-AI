(function(){
'use strict';
var API='https://wongming-ai.vercel.app',originals=new Map(),active='';
function saved(){try{return localStorage.getItem('wm_site_language')||'zh-Hant';}catch(e){return 'zh-Hant';}}
function save(v){try{localStorage.setItem('wm_site_language',v);}catch(e){}}
function collect(){
 var a=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(w.nextNode()){var n=w.currentNode,p=n.parentElement;if(!p||p.closest('#avatar-widget-root,script,style,noscript,textarea,input,select,option,button'))continue;var t=(n.nodeValue||'').replace(/\s+/g,' ').trim();if(t.length>1&&/[\u3400-\u9fff]/.test(t))a.push({n:n,t:t});}
 return a;
}
function restore(){originals.forEach(function(v,n){try{n.nodeValue=v;}catch(e){}});originals.clear();active='';}
window.__WM_TRANSLATE_PAGE__=async function(target){
 save(target);
 if(target==='zh-Hant'){restore();return;}
 if(active===target)return;
 restore();var nodes=collect();if(!nodes.length)return;
 nodes.forEach(function(x){originals.set(x.n,x.n.nodeValue);});
 try{
  for(var i=0;i<nodes.length;i+=25){
   var r=await fetch(API+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:target,items:nodes.slice(i,i+25).map(function(x){return x.t;})})});
   if(!r.ok)throw new Error('translation '+r.status);
   var j=await r.json(),a=j.translations||[];
   a.forEach(function(v,k){if(nodes[i+k])nodes[i+k].n.nodeValue=String(v);});
  }
  active=target;
 }catch(e){restore();console.warn('[Wongming translation]',e);}
};
window.addEventListener('load',function(){var target=saved();if(target&&target!=='zh-Hant')setTimeout(function(){window.__WM_TRANSLATE_PAGE__(target);},500);});
})();