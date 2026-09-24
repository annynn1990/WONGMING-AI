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
  var widgetUrl = (me && me.getAttribute('data-widget')) || (base + 'widget.html?v=20260924');
  var savedOpen = null;
  try { savedOpen = localStorage.getItem('wm_ai_open'); } catch (e) {}
  var attrOpen = me ? me.getAttribute('data-open') : null;
  var startOpen = savedOpen === '1' ? true : (savedOpen === '0' ? false : attrOpen !== 'false'); // 預設展開，可跨頁保留狀態
  var widgetOpen = startOpen;
  var widgetReady = false;
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
  (document.body || document.documentElement).appendChild(root);

  // 5) 展開 / 收合
  function setOpen(open) {
    widgetOpen = !!open;
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
  bubble.onclick = function () { setOpen(true); if (widgetReady && iframe.contentWindow) iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'host-context', context: pageContext() }, widgetOrigin); };
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
    intro: WM_FORUM_BASE + 'forum.php?mod=viewthread&tid=23066',
    register: WM_FORUM_BASE + 'member.php?mod=welcomewongmingempire'
  };
  var WM_FORUM_GREETINGS = {
    '58': '現在我們在韻賢角，這是一個充滿音樂的城市角落！不妨看看這裡最近有哪些音樂、活動與有趣的討論。',
    '88': '現在我們在皇宮，這裡是帝國皇室與君主相關事務的重要所在。',
    '92': '現在我們在內閣政府區，這裡可以看看帝國的政府機關與行政事務。',
    '90': '現在我們在國會，這裡可以看看帝國的議政、立法與國會活動。',
    '45': '現在我們在法律資源中心，這裡可以查閱帝國法律、法規與相關討論。',
    '129': '現在我們在外交相關區域，這裡可以看看帝國與友邦之間的交流與外交資訊。'
  };
  function getForumFid() {
    var m = (location.search || '').match(/[?&]fid=(\d+)/i);
    return m ? m[1] : '';
  }
  function detectForumArea() {
    var p = location.pathname + location.search;
    if (/fid=88/.test(p)) return '皇宮';
    if (/fid=92/.test(p)) return '內閣';
    if (/fid=90/.test(p)) return '國會';
    if (/fid=45/.test(p)) return '法律';
    if (/fid=129/.test(p)) return '外交';
    if (/fid=58/.test(p)) return '韻賢角';
    if (/bbswm\/?$/.test(p)) return '論壇首頁';
    return '';
  }
  function getForumGreeting() {
    var fid = getForumFid();
    if (fid && WM_FORUM_GREETINGS[fid]) return WM_FORUM_GREETINGS[fid];
    var title = (document.title || '').replace(/[-|｜].*$/, '').trim();
    if (fid && title) return '現在我們來到「' + title + '」，這裡有自己的主題與特色。你可以先看看目前的討論，也可以直接問我這個版面是做什麼的。';
    if (title) return '現在我們在「' + title + '」。你可以先看看這裡的內容，想了解這個地方也可以直接問我。';
    return '現在我們就在這個版面。你可以先看看這裡的內容，想知道這裡是做什麼的就直接問我吧。';
  }
  function pageContext() {
    return {
      url: location.href,
      title: document.title || '',
      path: location.pathname + location.search,
      area: detectForumArea(),
      fid: getForumFid(),
      greeting: getForumGreeting(),
      isOpen: widgetOpen
    };
  }
  function sendPageContent() {
    try {
      var root = document.body;
      if (!root || !iframe || !iframe.contentWindow) return;
      var clone = root.cloneNode(true);
      clone.querySelectorAll('#avatar-widget-root, script, style, noscript, iframe').forEach(function(n){ n.remove(); });
      var text = (clone.innerText || clone.textContent || '').replace(/\\s+/g,' ').trim();
      if (text.length > 14000) text = text.slice(0,14000);
      iframe.contentWindow.postMessage({ ns:NS_OUT, type:'host-page-content', text:text }, widgetOrigin);
    } catch(e) { console.warn('[Wongming AI] page content read failed',e); }
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
      widgetReady = true;
      iframe.contentWindow && iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'host-context', context: pageContext() }, widgetOrigin);
      setTimeout(sendPageContent, 300);
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
