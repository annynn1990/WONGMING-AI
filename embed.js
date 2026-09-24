/* =====================================================================
 * embed.js — AI 虛擬人嵌入載入器
 * 用法：在任何網站貼一行（跨網站請用部署後的完整網址）：
 *   <script src="https://YOUR-DEPLOY.example/embed.js"></script>
 *   同網域可用： <script src="embed.js" data-widget="widget.html"></script>
 *
 * 建立右下角 iframe（裝虛擬人）+ 收合泡泡，用 postMessage 與 iframe 溝通，
 * 並開好 microphone 權限。對外提供 window.AvatarWidget = { open, close, say }。
 * ===================================================================== */
(function () {
  'use strict';

  // 注入收合泡泡的 hover / 注意力 pulse 動畫
  var awStyle = document.createElement('style');
  awStyle.textContent =
    '#avatar-widget-root .aw-bubble{transition:transform .15s, box-shadow .15s;}'
    + '#avatar-widget-root .aw-bubble:hover{transform:scale(1.07);}'
    + '#avatar-widget-root .aw-bubble:active{transform:scale(.95);}'
    + '#avatar-widget-root .aw-bubble:focus-visible{outline:3px solid rgba(91,84,232,.45);outline-offset:3px;}'
    + '#avatar-widget-root .aw-bubble::after{content:"";position:absolute;inset:0;border-radius:50%;animation:awpulse 2.2s ease-out infinite;pointer-events:none;}'
    + '@keyframes awpulse{0%{box-shadow:0 0 0 0 rgba(91,84,232,.5);}70%{box-shadow:0 0 0 13px rgba(91,84,232,0);}100%{box-shadow:0 0 0 0 rgba(91,84,232,0);}}';
  (document.head || document.documentElement).appendChild(awStyle);

  // 1) 找出自己的位置，推算 widget.html 的網址（可用 data-widget 覆蓋）
  var me = document.currentScript || (function () {
    var ss = document.getElementsByTagName('script');
    for (var i = ss.length - 1; i >= 0; i--) { if (/embed\.js(\?|$)/.test(ss[i].src || '')) return ss[i]; }
    return null;
  })();
  var base = me ? me.src.replace(/[^/]*$/, '') : '';
  var widgetUrl = (me && me.getAttribute('data-widget')) || (base + 'widget.html?v=20260924-2');
  var savedOpen = null;
  try { savedOpen = localStorage.getItem('wm_ai_open'); } catch (e) {}
  var attrOpen = me ? me.getAttribute('data-open') : null;
  var startOpen = savedOpen === '1' ? true : (savedOpen === '0' ? false : attrOpen !== 'false'); // 預設展開，可跨頁保留狀態
  var widgetOrigin = (function () { try { return new URL(widgetUrl, location.href).origin; } catch (e) { return '*'; } })();

  // 把可設定項帶進 widget：皮=model / 肉的語音後端=api / 內容=knowledge / 聲線=voice
  var cfg = new URLSearchParams();
  ['model', 'api', 'knowledge', 'voice'].forEach(function (k) {
    var v = me && me.getAttribute('data-' + k);
    if (v) cfg.set(k, v);
  });
  var cfgQs = cfg.toString();
  var iframeSrc = widgetUrl + (cfgQs ? (widgetUrl.indexOf('?') < 0 ? '?' : '&') + cfgQs : '');

  var EXPANDED = { w: 340, h: 480 };
  var NS_OUT = 'avatar-widget-host'; // 父 → 子
  var NS_IN  = 'avatar-widget';      // 子 → 父

  // 2) 建外層容器
  var root = document.createElement('div');
  root.id = 'avatar-widget-root';
  root.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:16px',
    'z-index:2147483000', 'width:' + EXPANDED.w + 'px', 'height:' + EXPANDED.h + 'px'
  ].join(';');

  // 3) iframe（虛擬人本體）
  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.title = 'AI 虛擬人助理';                 // 無障礙：給 iframe 一個名字
  iframe.setAttribute('allow', 'microphone; autoplay'); // 語音輸入 + 音訊播放
  iframe.setAttribute('allowtransparency', 'true');
  iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;color-scheme:normal;';

  // 4) 收合後的小泡泡（iframe 收起時顯示，點它再展開）
  var bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.className = 'aw-bubble';
  bubble.setAttribute('aria-label', '開啟 AI 虛擬人助理');
  bubble.textContent = '💬';
  bubble.style.cssText = [
    'position:absolute', 'right:2px', 'bottom:2px', 'width:64px', 'height:64px',
    'border:0', 'border-radius:50%', 'cursor:pointer', 'font-size:28px',
    'background:linear-gradient(135deg,#7d78f0,#5b54e8)', 'color:#fff',
    'box-shadow:0 8px 22px rgba(0,0,0,.3)',
    'display:none', 'align-items:center', 'justify-content:center'
  ].join(';');

  root.appendChild(iframe);
  root.appendChild(bubble);
  (document.body || document.documentElement).appendChild(root);  // 全站語言按鈕：由父頁直接觸發，確保 Translator API 取得使用者手勢
  var langBtn = document.createElement('button');
  langBtn.type='button'; langBtn.textContent='🌐';
  langBtn.title='網站語言 / Website language';
  langBtn.style.cssText='position:fixed;right:24px;bottom:88px;z-index:2147483001;border:0;border-radius:999px;width:42px;height:42px;cursor:pointer;font-size:20px;background:rgba(255,255,255,.96);box-shadow:0 4px 16px rgba(0,0,0,.22);';
  (document.body || document.documentElement).appendChild(langBtn);
  var langMenu=document.createElement('div');
  langMenu.style.cssText='display:none;position:fixed;right:24px;bottom:136px;z-index:2147483002;background:#fff;border-radius:12px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.22);font:14px system-ui,sans-serif;';
  [['zh-Hant','中文'],['en','English'],['ja','日本語'],['ko','한국어']].forEach(function(item){
    var b=document.createElement('button'); b.type='button'; b.textContent=item[1]; b.style.cssText='display:block;width:120px;border:0;background:transparent;padding:9px 10px;text-align:left;cursor:pointer;border-radius:8px;';
    b.onclick=function(){langMenu.style.display='none'; handleTranslation(item[0]);};
    langMenu.appendChild(b);
  });
  (document.body || document.documentElement).appendChild(langMenu);
  langBtn.onclick=function(){langMenu.style.display=langMenu.style.display==='none'?'block':'none';};


  // 5) 展開 / 收合
  function setOpen(open) {
    try { localStorage.setItem('wm_ai_open', open ? '1' : '0'); } catch (e) {}
    if (open) {
      root.style.width = EXPANDED.w + 'px';
      root.style.height = EXPANDED.h + 'px';
      iframe.style.display = 'block';
      bubble.style.display = 'none';
    } else {
      root.style.width = '60px';
      root.style.height = '60px';
      iframe.style.display = 'none';
      bubble.style.display = 'flex';
    }
  }
  bubble.onclick = function () { setOpen(true); };
  setOpen(startOpen);

  // 6) 接收 iframe 的訊息（驗證來源 origin）
  // ===== 黃名論壇網站操作層 =====
  // AI 只能提出白名單 action；真正的網址/DOM 操作由宿主頁執行。
  var WM_FORUM_ORIGIN = 'https://www.wongmingempire.com';
  var WM_FORUM_BASE = WM_FORUM_ORIGIN + '/bbswm/';
  var WM_ROUTES = {
    home: WM_FORUM_BASE,
    palace: WM_FORUM_BASE + 'forum.php?fid=88&mod=forumdisplay',
    cabinet: WM_FORUM_BASE + 'forum.php?fid=92&mod=forumdisplay',
    parliament: WM_FORUM_BASE + 'forum.php?fid=90&mod=forumdisplay',
    foreign_affairs: WM_FORUM_BASE + 'forum.php?fid=129&mod=forumdisplay',
    laws: WM_FORUM_BASE + 'forum.php?fid=45&mod=forumdisplay',
    structure: WM_FORUM_BASE + 'forum.php?extra=page%3D1&mod=viewthread&tid=22468',
    intro: WM_FORUM_BASE + 'forum.php?mod=viewthread&tid=23066'
  };
  function detectForumArea() {
    var p = location.pathname + location.search;
    if (/fid=88/.test(p)) return '皇宮';
    if (/fid=92/.test(p)) return '內閣';
    if (/fid=90/.test(p)) return '國會';
    if (/fid=45/.test(p)) return '法律';
    if (/fid=129/.test(p)) return '外交';
    if (/bbswm\/?$/.test(p)) return '論壇首頁';
    return '';
  }
  function getVisiblePageText() {
    try {
      var clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,iframe,svg').forEach(function(n){ n.remove(); });
      return (clone.innerText || clone.textContent || '').replace(/\s+/g,' ').trim().slice(0,12000);
    } catch (e) { return ''; }
  }
  function sendPageContent() {
    try {
      if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({
        ns: NS_OUT, type:'host-page-content', text:getVisiblePageText()
      }, widgetOrigin);
    } catch(e) {}
  }

  async function handleTranslation(target) {
    if (target === 'zh-Hant') { location.reload(); return; }
    try {
      localStorage.setItem('wm_ai_language', target);
      if (!window.Translator || !window.Translator.create) {
        alert('此瀏覽器尚未提供內建翻譯 API。請使用支援 Translator API 的新版 Chrome。');
        return;
      }
      var translator = await window.Translator.create({sourceLanguage:'zh', targetLanguage:target});
      var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      var nodes=[],n;
      while(n=walker.nextNode()){
        if(!n.nodeValue.trim() || n.parentElement.closest('#avatar-widget-root,#avatar-widget-root *,script,style,noscript')) continue;
        if(!n.parentElement.dataset.wmOriginal) n.parentElement.dataset.wmOriginal=n.nodeValue;
        nodes.push(n);
      }
      for(var i=0;i<nodes.length;i++){
        var node=nodes[i];
        var raw=node.nodeValue;
        if(!raw.trim() || /^[\d\W_]+$/.test(raw)) continue;
        try{ node.nodeValue=await translator.translate(raw); }catch(e){}
      }
      try { iframe.contentWindow.postMessage({ns:NS_OUT,type:'language-changed',language:target},widgetOrigin); } catch(e){}
    } catch(e) {
      console.error('[Wongming AI] translation failed',e);
      alert('翻譯初始化失敗：'+(e.message||e));
    }
  }

  function pageContext() {
    return { url: location.href, title: document.title || '', path: location.pathname + location.search, area: detectForumArea() };
  }
  function savePendingNavigation(action) {
    try { localStorage.setItem('wm_ai_pending_action', JSON.stringify({ action: action, at: Date.now() })); } catch (e) {}
  }
  function scrollHost(direction, amount) {
    var px = Math.max(100, Math.min(2000, Number(amount) || 650));
    if (direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    else window.scrollBy({ top: direction === 'up' ? -px : px, behavior: 'smooth' });
  }
  function handleHostAction(action) {
    if (!action || typeof action !== 'object') return;
    var type = String(action.action || action.type || '').toLowerCase();
    if (type === 'navigate') {
      var url = WM_ROUTES[String(action.target || '').toLowerCase()];
      if (!url) return;
      savePendingNavigation(action);
      location.href = url;
      return;
    }
    if (type === 'back') { history.back(); return; }
    if (type === 'forward') { history.forward(); return; }
    if (type === 'scroll') { scrollHost(String(action.direction || 'down').toLowerCase(), action.amount); return; }
    if (type === 'top') { scrollHost('top'); return; }
    if (type === 'bottom') { scrollHost('bottom'); return; }
  }
  window.addEventListener('message', function (e) {
    if (widgetOrigin !== '*' && e.origin !== widgetOrigin) return;
    var d = e.data || {};
    if (d.ns !== NS_IN) return;
    if (d.type === 'close') setOpen(false);
    if (d.type === 'ready') {
      iframe.contentWindow && iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'host-context', context: pageContext() }, widgetOrigin);
      setTimeout(sendPageContent, 250);
      try {
        var pending = JSON.parse(localStorage.getItem('wm_ai_pending_action') || 'null');
        if (pending && pending.action && Date.now() - Number(pending.at || 0) < 60000) {
          localStorage.removeItem('wm_ai_pending_action');
          iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'navigation-complete', action: pending.action, context: pageContext() }, widgetOrigin);
          setTimeout(sendPageContent, 500);
        } else if (pending) localStorage.removeItem('wm_ai_pending_action');
      } catch (err) {}
    }
    if (d.type === 'action') handleHostAction(d.action);
    if (d.type === 'error') console.warn('[avatar] widget error:', d.message);
  });

  // 7) 對外 API：別的程式可以叫她說話 / 開關
  window.AvatarWidget = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    say: function (text) {
      setOpen(true);
      iframe.contentWindow && iframe.contentWindow.postMessage(
        { ns: NS_OUT, type: 'say', text: String(text || '').slice(0, 600) }, widgetOrigin);
    }
  };
})();
