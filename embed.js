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

  try {
    if (new URLSearchParams(location.search).get('wm_holiday_reader') === '1') return;
  } catch (e) {}

  // 黃名天文台（fid=554）不載入虛擬人；從該版面進入的主題頁也沿用停用狀態。
  var wmHideForForum554 = false;
  try {
    var earlyParams554 = new URLSearchParams(location.search || '');
    var earlyMod554 = earlyParams554.get('mod') || '';
    var earlyFid554 = earlyParams554.get('fid') || '';
    if (/\/bbswm\/forum\.php$/i.test(location.pathname)) {
      if (earlyMod554 === 'forumdisplay' && earlyFid554 === '554') {
        wmHideForForum554 = true;
        try { sessionStorage.setItem('wm_current_forum_fid', '554'); } catch (e) {}
      } else if (earlyMod554 === 'viewthread') {
        if (earlyFid554) {
          wmHideForForum554 = earlyFid554 === '554';
          try { sessionStorage.setItem('wm_current_forum_fid', earlyFid554); } catch (e) {}
        } else {
          try { wmHideForForum554 = sessionStorage.getItem('wm_current_forum_fid') === '554'; } catch (e) {}
        }
      }
    }
  } catch (e) {}
  if (wmHideForForum554) {
    try {
      var oldAvatarRoot554 = document.getElementById('avatar-widget-root');
      if (oldAvatarRoot554) oldAvatarRoot554.remove();
      delete window.AvatarWidget;
    } catch (e) {}
    window.__WM_AVATAR_WIDGET_INSTANCE__ = false;
    return;
  }

  if (document.getElementById('avatar-widget-root') || window.__WM_AVATAR_WIDGET_INSTANCE__) return;
  window.__WM_AVATAR_WIDGET_INSTANCE__ = true;

  // 進入論壇時先判斷目前所在的版區。fid=55 會進入「禁用區」，
  // 帖子頁若沒有 fid，沿用同一分區的 session 記憶。
  var bootstrapStartOpen = null;
  var bootstrapForumFid = '';
  var bootstrapBlocked55 = false;
  try {
    // 不讀取舊的跨工作階段開啟值，否則會繞過延遲載入。
    var savedSession = sessionStorage.getItem('wm_ai_open_session');
    var me0 = document.currentScript || null;
    var attrOpen0 = me0 ? me0.getAttribute('data-open') : null;
    bootstrapStartOpen = savedSession === '1' ? true : (savedSession === '0' ? false : attrOpen0 === 'true');
    var search0 = location.search || '';
    var fidMatch0 = search0.match(/[?&]fid=(\d+)/i);
    if (fidMatch0) {
      bootstrapForumFid = fidMatch0[1];
      sessionStorage.setItem('wm_current_forum_fid', bootstrapForumFid);
    } else if (/(?:^|[?&])mod=viewthread(?:&|$)/i.test(search0)) {
      bootstrapForumFid = sessionStorage.getItem('wm_current_forum_fid') || '';
    } else {
      sessionStorage.removeItem('wm_current_forum_fid');
      bootstrapForumFid = '';
    }
    if (bootstrapForumFid !== '55') sessionStorage.removeItem('wm_fid55_blocked');
    bootstrapBlocked55 = bootstrapForumFid === '55' && sessionStorage.getItem('wm_fid55_blocked') === '1';

    // 永享堂（fid=55）是特殊的「禁用區」：
    // 第一次進入時必須強制建立導覽員，才能說出「嗚嗚嗚」；
    // 不受使用者上一次把導覽員收合（wm_ai_open=0）的狀態影響。
    // 說完後會由 ready handler 設定 wm_fid55_blocked 並移除導覽員。
    if (bootstrapForumFid === '55' && !bootstrapBlocked55) {
      bootstrapStartOpen = true;
    }
  } catch (e) {}

  // 永享堂已經說過並關閉後，在同一區及其帖子內完全不建立導覽員。
  if (bootstrapForumFid === '55' && bootstrapBlocked55) {
    return;
  }

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
  var widgetOverride = me ? (me.getAttribute('data-widget') || '') : '';
  var widgetUrl = (widgetOverride && !/wongming-ai\.vercel\.app/i.test(widgetOverride)) ? widgetOverride : (base + 'widget.html?v=20261028static1');
  // 預設先收合；只在同一分頁已開啟，或嵌入端明確設定 data-open="true" 時自動載入。
  // 用 sessionStorage 保留同一分頁的操作狀態，不再沿用舊的跨工作階段 localStorage 開啟值。
  var savedOpenSession = null;
  try { savedOpenSession = sessionStorage.getItem('wm_ai_open_session'); } catch (e) {}
  var attrOpen = me ? me.getAttribute('data-open') : null;
  var startOpen = bootstrapStartOpen !== null
    ? bootstrapStartOpen
    : (savedOpenSession === '1' ? true : (savedOpenSession === '0' ? false : attrOpen === 'true'));
  var widgetOpen = startOpen;
  var iframeLoaded = false;
  var widgetReady = false;
  var widgetReadyHandled = false;
  var pendingSayText = null;
  var widgetHandshakeTimers = [];
  var widgetOrigin = (function () { try { return new URL(widgetUrl, location.href).origin; } catch (e) { return '*'; } })();

  // 把可設定項帶進 widget：皮=model / 肉的語音後端=api / 內容=knowledge / 聲線=voice
  var cfg = new URLSearchParams();
  ['model', 'api', 'knowledge'].forEach(function (k) {
    var v = me && me.getAttribute('data-' + k);
    if (v && !(k === 'api' && /wongming-ai\.vercel\.app/i.test(v))) cfg.set(k, v);
  });
  // 不預設連線雲端 TTS。未明確指定非 Vercel API 時，widget 會使用瀏覽器內建語音。
  cfg.set('voice', 'zh-TW-HsiaoChenNeural');
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
  // iframe 暫不設定 src；setOpen(true) 時才載入虛擬人資源。
  iframe.title = 'AI 虛擬人助理';                 // 無障礙：給 iframe 一個名字
  iframe.setAttribute('allow', 'microphone; autoplay'); // 語音輸入 + 音訊播放
  iframe.setAttribute('allowtransparency', 'true');
  iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;color-scheme:normal;';

  // 整頁翻譯程式只在訪客主動選擇頁面語言時載入，避免每次論壇翻頁都多抓一支 script。
  var translationPageScriptLoading = false;
  function loadTranslationPageScript(target) {
    var requested = String(target || '');
    if (['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'].indexOf(requested) < 0) return;
    if (typeof window.__WM_TRANSLATE_PAGE__ === 'function') {
      window.__WM_TRANSLATE_PAGE__(requested);
      return;
    }
    window.__WM_TRANSLATE_PENDING__ = requested;
    if (translationPageScriptLoading) return;
    translationPageScriptLoading = true;
    try {
      var translationPageScript = document.createElement('script');
      translationPageScript.src = base + 'translation-page.js?v=20261028static1';
      translationPageScript.async = true;
      translationPageScript.onload = function () {
        translationPageScriptLoading = false;
        try {
          var pendingTarget = window.__WM_TRANSLATE_PENDING__;
          if (pendingTarget && window.__WM_TRANSLATE_PAGE__) {
            window.__WM_TRANSLATE_PENDING__ = '';
            window.__WM_TRANSLATE_PAGE__(pendingTarget);
          }
        } catch (e) {}
      };
      translationPageScript.onerror = function () {
        translationPageScriptLoading = false;
      };
      document.head.appendChild(translationPageScript);
    } catch (e) {
      translationPageScriptLoading = false;
    }
  }

  // 保留曾主動選擇整頁翻譯的訪客偏好；未選擇過的人不載入翻譯程式。
  try {
    var savedPageLanguage = localStorage.getItem('wm_site_language_manual') || '';
    if (savedPageLanguage && savedPageLanguage !== 'zh-Hant') {
      loadTranslationPageScript(savedPageLanguage);
    }
  } catch (e) {}

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

  // 5) 展開 / 收合。iframe 第一次展開才會開始載入，之後重複展開不重載。
  function ensureIframeLoaded() {
    if (iframeLoaded) return;
    iframeLoaded = true;
    iframe.src = iframeSrc;
  }
  function setOpen(open) {
    widgetOpen = !!open;
    try { sessionStorage.setItem('wm_ai_open_session', open ? '1' : '0'); } catch (e) {}
    if (open) {
      ensureIframeLoaded();
      root.style.width = EXPANDED.w + 'px';
      root.style.height = EXPANDED.h + 'px';
      iframe.style.display = 'block';
      bubble.style.display = 'none';
      // iframe 從 display:none 恢復後，通知子頁重新量測 renderer/canvas。
      setTimeout(function () {
        try {
          if (iframe.contentWindow) iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'avatar-resume' }, widgetOrigin);
        } catch (e) {}
      }, 60);
    } else {
      root.style.width = '60px';
      root.style.height = '60px';
      iframe.style.display = 'none';
      bubble.style.display = 'flex';
    }

  }
  bubble.onclick = function () {
    setOpen(true);
    if (widgetReady && iframe.contentWindow) {
      preparePageContext().then(function (ctx) {
        if (iframe.contentWindow) iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'host-context', context: ctx }, widgetOrigin);
      });
    }
  };
  setOpen(startOpen);

  function pingWidget() {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'ping' }, widgetOrigin);
      }
    } catch (e) {}
  }

  iframe.addEventListener('load', function () {
    pingWidget();
    [120, 600, 1600, 3200].forEach(function (delay) {
      var t = setTimeout(function () {
        if (!widgetReady) pingWidget();
      }, delay);
      widgetHandshakeTimers.push(t);
    });
  });

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
    register: WM_FORUM_BASE + 'member.php?mod=welcomewongmingempire',
    tour0: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=36',
    tour1: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=72',
    tour2: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=357',
    tour3: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=461',
    tour4: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=273',
    tour5: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=92',
    tour6: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=90',
    tour7: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=91',
    tour8: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=88',
    tour9: WM_FORUM_BASE + 'forum.php?mod=forumdisplay&fid=89'
  };
  var WM_BLOCKED_FORUMS = {
    '55': '嗚嗚嗚，這裡我不方便帶你導覽喔，再見。'
  };
  var WM_FORUM_GREETINGS = {
    '58': '現在我們在韻賢角，這是一個充滿音樂的城市角落！不妨看看這裡最近有哪些音樂、活動與有趣的討論。',
    '88': '現在我們在皇宮，這裡是帝國皇室與君主相關事務的重要所在。',
    '92': '現在我們在內閣政府區，這裡可以看看帝國的政府機關與行政事務。',
    '90': '現在我們在國會，這裡可以看看帝國的議政、立法與國會活動。',
    '45': '現在我們在法律資源中心，這裡可以查閱帝國法律、法規與相關討論。',
    '129': '現在我們在外交相關區域，這裡可以看看帝國與友邦之間的交流與外交資訊。',
    '183': '「聖賢殿」是皇室與政府公開大典場地，請保持恭敬不要大聲喧嘩。左側的入口是皇家音樂廳可以聆聽國家演奏。'
  };

  var wmTodayHolidayGreeting = '';
  var wmTodayHolidayPromise = null;

  function wmTodayDateVariants() {
    var d = new Date();
    var y = d.getFullYear();
    var roc = y - 1911;
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var mm = String(m).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    return [
      y + '-' + mm + '-' + dd,
      y + '/' + mm + '/' + dd,
      y + '.' + mm + '.' + dd,
      y + '年' + m + '月' + day + '日',
      y + '年' + mm + '月' + dd + '日',
      roc + '年' + m + '月' + day + '日',
      m + '月' + day + '日',
      mm + '月' + dd + '日',
      m + '/' + day,
      mm + '/' + dd,
      m + '-' + day,
      mm + '-' + dd
    ];
  }

  function wmHolidayContainsToday(text) {
    var t = String(text || '').replace(/\s+/g, '');
    return wmTodayDateVariants().some(function (v) { return t.indexOf(v) >= 0; });
  }

  function wmReadHolidayGreetingFromDoc(doc) {
    try {
      var sections = doc.querySelectorAll('#holiday-sections .section');
      var today = [];
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var dateEl = section.querySelector('.date');
        var nameEl = section.querySelector('.location');
        var dateText = dateEl ? (dateEl.textContent || '').trim() : '';
        var name = nameEl ? (nameEl.textContent || '').trim() : '';
        if (!name || !dateText) continue;
        if (wmHolidayContainsToday(dateText)) today.push(name);
      }
      if (today.length) {
        var unique = today.filter(function (name, idx, arr) { return arr.indexOf(name) === idx; });
        return '今天是「' + unique.join('、') + '」，祝您節日愉快！';
      }
    } catch (e) {}
    return '';
  }

  function loadTodayHolidayGreeting() {
    if (wmTodayHolidayPromise) return wmTodayHolidayPromise;
    if (detectForumArea() !== '論壇首頁') return Promise.resolve('');

    var cacheKey = 'wm_today_holiday_source_v5_' + new Date().toISOString().slice(0, 10);

    function greetingFromSource(data) {
      if (!data || !data.today || !data.today.length) return '';
      var names = data.today.map(function (x) { return x.name; }).filter(Boolean);
      names = names.filter(function (n, i, a) { return a.indexOf(n) === i; });
      return names.length ? '今天是「' + names.join('、') + '」，祝您節日愉快！' : '';
    }

    function readStored() {
      try {
        var raw = localStorage.getItem('wm_holiday_source_v3');
        if (raw) {
          var data = JSON.parse(raw);
          var todayKey = new Date().toISOString().slice(0, 10);
          if (data && data.date === todayKey) {
            return greetingFromSource(data);
          }
        }
      } catch (e) {}
      return '';
    }

    var stored = readStored();
    if (stored) {
      wmTodayHolidayGreeting = stored;
      return Promise.resolve(stored);
    }

    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        wmTodayHolidayGreeting = cached === '__NONE__' ? '' : cached;
        return Promise.resolve(wmTodayHolidayGreeting);
      }
    } catch (e) {}

    return Promise.resolve('');
  }

  async function preparePageContext() {
    if (detectForumArea() === '論壇首頁') {
      startHolidaySource();
      var started = Date.now();
      while (!wmTodayHolidayGreeting && Date.now() - started < 6000) {
        await new Promise(function (resolve) { setTimeout(resolve, 150); });
        await loadTodayHolidayGreeting();
      }
    }
    return pageContext();
  }

  function getForumFid() {
    var search = location.search || '';
    var m = search.match(/[?&]fid=(\d+)/i);
    if (m) {
      try { sessionStorage.setItem('wm_current_forum_fid', m[1]); } catch (e) {}
      return m[1];
    }
    var p = location.pathname + search;
    if (/forum\.php$/i.test(location.pathname) && /(?:^|[?&])mod=viewthread(?:&|$)/i.test(search)) {
      try {
        return sessionStorage.getItem('wm_current_forum_fid') || '';
      } catch (e) {}
    }
    if (/bbswm\/?$/.test(p)) {
      try { sessionStorage.removeItem('wm_current_forum_fid'); } catch (e) {}
    }
    return '';
  }
  function detectForumArea() {
    var fid = getForumFid();
    if (fid === '88') return '皇宮';
    if (fid === '92') return '內閣';
    if (fid === '90') return '國會';
    if (fid === '45') return '法律';
    if (fid === '129') return '外交';
    if (fid === '58') return '韻賢角';
    if (/bbswm\/?$/.test(location.pathname + location.search)) return '論壇首頁';
    return '';
  }
  function getForumAreaState(fid, area) {
    // 以「區域/fid」作為介紹單位：只要仍在同一個區域內，
    // 不論切換版面、帖子或其他頁面，都不要重複介紹；只有離開該區域後再進入才重新介紹。
    var key = String(fid || area || '').trim();
    if (!key) return { key: '', pending: false };
    try {
      var current = sessionStorage.getItem('wm_current_forum_area') || '';
      var pending = sessionStorage.getItem('wm_pending_forum_greeting') === '1';
      if (current !== key) {
        sessionStorage.setItem('wm_current_forum_area', key);
        sessionStorage.setItem('wm_pending_forum_greeting', '1');
        pending = true;
      }
      return { key: key, pending: pending };
    } catch (e) {
      return { key: key, pending: true };
    }
  }
  function wmGetTodayHolidayNamesFromDoc(doc) {
    try {
      var sections = doc.querySelectorAll('#holiday-sections .section');
      var names = [];
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var dateEl = section.querySelector('.date');
        var nameEl = section.querySelector('.location');
        var dateText = dateEl ? (dateEl.textContent || '').trim() : '';
        var name = nameEl ? (nameEl.textContent || '').trim() : '';
        if (!name || !dateText || !wmHolidayContainsToday(dateText)) continue;
        if (names.indexOf(name) < 0) names.push(name);
      }
      return names;
    } catch (e) {
      return [];
    }
  }

  function wmGetAnnouncementInfo() {
    var fid = getForumFid();
    if (fid !== '36') return { count: 0, titles: [] };

    var selectors = [
      '#forumannouncements li',
      '#forum_announcements li',
      '#announcements li',
      '.forumannouncements li',
      '.announcementlist li',
      '[id*="announcement"] li',
      '[class*="announcement"] li'
    ];
    var nodes = [];
    var seen = [];

    try {
      for (var i = 0; i < selectors.length; i++) {
        var found = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < found.length; j++) {
          if (seen.indexOf(found[j]) >= 0) continue;
          seen.push(found[j]);
          var text = (found[j].innerText || found[j].textContent || '').replace(/\\s+/g, ' ').trim();
          if (!text || /^公告$|^論壇公告$|^站務公告$/.test(text)) continue;
          nodes.push(found[j]);
        }
      }
    } catch (e) {}

    var titles = nodes.map(function (node) {
      var link = node.querySelector('a');
      return ((link ? link.innerText || link.textContent : node.innerText || node.textContent) || '')
        .replace(/\\s+/g, ' ').trim();
    }).filter(function (title, idx, arr) {
      return title && arr.indexOf(title) === idx;
    });

    return { count: titles.length, titles: titles.slice(0, 8) };
  }

  function getForumGreeting() {
    var fid = getForumFid();
    if (detectForumArea() === '論壇首頁') {
      var welcome = '歡迎來到「黃名帝國」，';
      if (wmTodayHolidayGreeting) {
        var holiday = String(wmTodayHolidayGreeting).replace(/^今天是「/, '今天是「');
        return welcome + holiday + '有任何疑問都可以直接問我。';
      }
      return welcome + '有任何疑問都可以直接問我。';
    }
    if (fid === '36') {
      var names = wmGetTodayHolidayNamesFromDoc(document);
      var info = wmGetAnnouncementInfo();
      var parts = [];
      if (names.length) {
        parts.push('今天是「' + names.join('、') + '」，祝您節日愉快！');
      }
      parts.push('這裡是崇興門，是帝國皇室與政府的公告區！');
      if (info.count > 0) {
        parts.push('目前有 ' + info.count + ' 則公告要留意喔！');
      }
      return parts.join(' ');
    }
    if (detectForumArea() === '論壇首頁' && wmTodayHolidayGreeting) return wmTodayHolidayGreeting;
    if (fid && WM_FORUM_GREETINGS[fid]) return WM_FORUM_GREETINGS[fid];
    var title = (document.title || '').replace(/[-|｜].*$/, '').trim();
    if (fid && title) return '現在我們來到「' + title + '」，這裡有自己的主題與特色。你可以先看看目前的討論，也可以直接問我這個版面是做什麼的。';
    if (title) return '現在我們在「' + title + '」。你可以先看看這裡的內容，想了解這個地方也可以直接問我。';
    return '現在我們就在這個版面。你可以先看看這裡的內容，想知道這裡是做什麼的就直接問我吧。';
  }
  var wmHolidaySourceStarted = false;

  function startHolidaySource() {
    if (wmHolidaySourceStarted || detectForumArea() !== '論壇首頁') return;
    wmHolidaySourceStarted = true;

    try {
      var frame = document.createElement('iframe');
      frame.id = 'wm-holiday-source-frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none;';
      frame.src = base + 'holiday-source.html?v=20261028static1';
      (document.body || document.documentElement).appendChild(frame);

      setTimeout(function () {
        try { frame.remove(); } catch (e) {}
      }, 12000);
    } catch (e) {}
  }

  function pageContext() {
    var fid = getForumFid();
    var area = detectForumArea();
    var areaState = getForumAreaState(fid, area);
    // 首頁每天只要有今天的節日資料，就在本次頁面載入時自動介紹；
    // 不讓 sessionStorage 裡「已介紹過」的狀態阻止首頁節日提醒。
    var shouldGreet = !!(widgetOpen && (areaState.pending || (area === '論壇首頁' && wmTodayHolidayGreeting)));
    if (shouldGreet) {
      try { sessionStorage.removeItem('wm_pending_forum_greeting'); } catch (e) {}
    }
    return {
      url: location.href,
      title: document.title || '',
      path: location.pathname + location.search,
      area: area,
      fid: fid,
      greeting: getForumGreeting(),
      announcementCount: wmGetAnnouncementInfo().count,
      announcementTitles: wmGetAnnouncementInfo().titles,
      isOpen: widgetOpen,
      shouldGreet: shouldGreet
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
    if (type === 'navigate-url') {
      var directUrl = String(action.url || '').trim();
      if (!/^https:\/\/www\.wongmingempire\.com\/bbswm\//i.test(directUrl)) return;
      location.href = directUrl;
      return;
    }
    if (type === 'back') { history.back(); return; }
    if (type === 'forward') { history.forward(); return; }
    if (type === 'scroll') { scrollHost(String(action.direction || 'down').toLowerCase(), action.amount); return; }
    if (type === 'top') { scrollHost('top'); return; }
    if (type === 'bottom') { scrollHost('bottom'); return; }
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};

    // 國際化模組：只處理翻譯，不介入導覽員核心。
    if (d.ns === 'avatar-widget' && d.type === 'action' && d.action && d.action.action === 'translate') {
      // 這個跨頁面訊息只接受來自虛擬人 iframe 的請求。
      if (widgetOrigin !== '*' && e.origin !== widgetOrigin) return;
      var target = String(d.action.target || 'en');
      loadTranslationPageScript(target);
      return;
    }

    // 節日資料源是獨立的 holiday-source.html，不屬於虛擬人的 widgetOrigin。
    // 先接收它，再做 widgetOrigin 的安全檢查。
    if (d.ns === 'wongming-holiday' && d.type === 'holiday-data' && d.data) {
      try {
        var today = Array.isArray(d.data.today) ? d.data.today : [];
        wmTodayHolidayGreeting = d.data.greeting ||
          (today.length ? '今天是「' + today.map(function (x) { return x.name; }).join('、') + '」，祝您節日愉快！' : '');
        localStorage.setItem('wm_holiday_source_v3', JSON.stringify(d.data));
      } catch (err) {}
      if (detectForumArea() === '論壇首頁' && widgetReady && widgetOpen && wmTodayHolidayGreeting) {
        iframe.contentWindow && iframe.contentWindow.postMessage({
          ns: NS_OUT,
          type: 'holiday-greeting',
          text: wmTodayHolidayGreeting
        }, widgetOrigin);
      }
      return;
    }

    if (widgetOrigin !== '*' && e.origin !== widgetOrigin) return;
    if (d.ns !== NS_IN) return;
    if (d.type === 'close') setOpen(false);
    if (d.type === 'ready') {
      widgetReady = true;
      widgetHandshakeTimers.forEach(function (t) { try { clearTimeout(t); } catch (err) {} });
      if (widgetReadyHandled) return;
      widgetReadyHandled = true;
      var blockedGreeting = WM_BLOCKED_FORUMS[getForumFid()];
      if (blockedGreeting) {
        try { sessionStorage.setItem('wm_fid55_blocked', '1'); } catch (e) {}
        iframe.contentWindow && iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'say', text: blockedGreeting }, widgetOrigin);
        iframe.style.pointerEvents = 'none';
        setTimeout(function () {
          try { root.remove(); } catch (e) {
            try { root.style.display = 'none'; } catch (e2) {}
          }
        }, 3750);
        return;
      }
      if (pendingSayText !== null && iframe.contentWindow) {
        var queuedSayText = pendingSayText;
        pendingSayText = null;
        iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'say', text: queuedSayText }, widgetOrigin);
      }
      (async function () {
        startHolidaySource();
        var ctx = await preparePageContext();
        if (!iframe.contentWindow) return;
        iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'host-context', context: ctx }, widgetOrigin);
        setTimeout(sendPageContent, 300);
        try {
        var pending = JSON.parse(localStorage.getItem('wm_ai_pending_action') || 'null');
        if (pending && pending.action && Date.now() - Number(pending.at || 0) < 60000) {
          localStorage.removeItem('wm_ai_pending_action');
          iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'navigation-complete', action: pending.action, context: pageContext() }, widgetOrigin);
          setTimeout(sendPageContent, 500);
        } else if (pending) localStorage.removeItem('wm_ai_pending_action');
        } catch (err) {}
      })();
    }
    if (d.type === 'action') handleHostAction(d.action);
    if (d.type === 'error') console.warn('[avatar] widget error:', d.message);
  });

  // 7) 對外 API：別的程式可以叫她說話 / 開關
  window.AvatarWidget = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    say: function (text) {
      var safeText = String(text || '').slice(0, 600);
      setOpen(true);
      if (widgetReady && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ ns: NS_OUT, type: 'say', text: safeText }, widgetOrigin);
      } else {
        pendingSayText = safeText;
      }
    }
  };
})();
