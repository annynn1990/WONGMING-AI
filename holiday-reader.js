(function () {
  'use strict';

  function normalizeDateText(s) {
    return String(s || '')
      .replace(/\s+/g, '')
      .replace(/0+(\d{1,2})月/g, '$1月')
      .replace(/0+(\d{1,2})日/g, '$1日');
  }

  function parseMd(s) {
    const m = normalizeDateText(s).match(/(\d{1,2})月(\d{1,2})日/);
    return m ? { month: Number(m[1]), day: Number(m[2]) } : null;
  }

  function isTodayDateText(text, month, day) {
    const t = normalizeDateText(text);
    const range = t.match(/(\d{1,2})月(\d{1,2})日[-–—至](\d{1,2})月(\d{1,2})日/);
    if (range) {
      const sm = Number(range[1]), sd = Number(range[2]);
      const em = Number(range[3]), ed = Number(range[4]);
      const cur = month * 100 + day;
      return cur >= sm * 100 + sd && cur <= em * 100 + ed;
    }
    const one = parseMd(t);
    return !!one && one.month === month && one.day === day;
  }

  function collect() {
    const now = new Date();
    const y = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const sections = document.querySelectorAll('#holiday-sections .section');
    const all = [];
    const today = [];

    sections.forEach(function (section) {
      const dateEl = section.querySelector('.date');
      const nameEl = section.querySelector('.location');
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) return;

      const item = {
        name: name,
        date: dateText,
        isToday: isTodayDateText(dateText, month, day)
      };
      all.push(item);
      if (item.isToday) today.push(item);
    });

    window.WM_HOLIDAY_SOURCE = {
      source: 'forum-fid-36-dom',
      date: y + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      today: today,
      holidays: all,
      ready: true
    };

    try {
      localStorage.setItem('wm_holiday_source_v3', JSON.stringify(window.WM_HOLIDAY_SOURCE));
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('wm-holiday-ready', {
        detail: window.WM_HOLIDAY_SOURCE
      }));
    } catch (e) {}

    return window.WM_HOLIDAY_SOURCE;
  }

  function boot() {
    if (document.querySelector('#holiday-sections')) {
      if (document.querySelector('#holiday-sections .section')) {
        collect();
      } else {
        const observer = new MutationObserver(function () {
          if (document.querySelector('#holiday-sections .section')) {
            observer.disconnect();
            collect();
          }
        });
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });
        setTimeout(function () {
          try { observer.disconnect(); } catch (e) {}
          if (!window.WM_HOLIDAY_SOURCE) collect();
        }, 5000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();