(function(){
'use strict';
var toast;
function showStatus(text){
  if(!toast){
    toast=document.createElement('div');
    toast.id='wm-translation-status';
    toast.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147482999;padding:10px 16px;border-radius:999px;background:rgba(26,28,46,.94);color:#fff;font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:calc(100vw - 40px);text-align:center;';
    (document.body||document.documentElement).appendChild(toast);
  }
  toast.textContent=text;
  setTimeout(function(){try{toast.remove();}catch(e){}toast=null;},4500);
}
window.__WM_TRANSLATE_PAGE__=function(){
  showStatus('為節省流量，整頁雲端翻譯目前已停用；虛擬人導覽與瀏覽器語音仍可使用。');
};
})();
