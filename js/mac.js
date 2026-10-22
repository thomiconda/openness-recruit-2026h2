/* 맥 OS 바탕화면 느낌 덧입힘: 메뉴바 시계 + 아래 Dock(메뉴 바로가기)
 * 화면 구성·데이터는 js/app.js 가 그대로 담당하고, 이 파일은 데이터를 읽지 않는다.
 * 빼려면 index.html 에서 이 파일과 css/mac.css 두 줄만 지우면 된다. */
(function () {
  'use strict';
  var wk = ['일', '월', '화', '수', '목', '금', '토'];
  var GLYPH = {
    home: '<path d="M5.5 19.5V11M12 19.5V4.5M18.5 19.5v-6.5"/>',
    list: '<path d="M9.5 7h10M9.5 12h10M9.5 17h10"/><circle cx="5" cy="7" r=".9"/><circle cx="5" cy="12" r=".9"/><circle cx="5" cy="17" r=".9"/>',
    personal: '<rect x="3" y="5" width="18" height="14" rx="2.8"/><circle cx="9" cy="11" r="2"/><path d="M6 16.2c.9-1.7 4.1-1.7 6 0M14.5 10h3.5M14.5 14h2.5"/>',
    detail: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-4 3.6-5.6 7-5.6s6.1 1.6 7 5.6"/>',
    interview: '<path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6l-4.9 2.6.9-5.5-4-3.9L9.5 9z"/>',
    guide: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.9v.1"/>'
  };
  // 경로는 js/app.js 의 ROUTES 와 같다. 이름·순서를 바꾸면 여기도 맞춰 준다.
  var NAV = [
    { k: 'home', label: '현황', href: '#/', g: 'mc-g-blue' },
    { k: 'list', label: '지원자 목록', href: '#/list', g: 'mc-g-green' },
    { k: 'personal', label: '인적사항', href: '#/personal', g: 'mc-g-orange' },
    { k: 'detail', label: '지원자 상세', href: '#/applicant', g: 'mc-g-purple' },
    { k: 'schedule', label: '전형 일정', href: '#/schedule', cal: true },
    { k: 'interview', label: '면접 대상자', href: '#/interview', g: 'mc-g-pink' },
    { k: 'guide', label: '안내', href: '#/guide', g: 'mc-g-gray' }
  ];

  function clockHTML() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    return '<span class="mc-dt">' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + wk[d.getDay()] + ') </span>' + (h < 12 ? '오전' : '오후') + ' ' + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
  }
  function iconHTML(n) {
    if (n.cal) { var t = new Date(); return '<span class="mc-app mc-cal" aria-hidden="true"><span class="mc-h">' + wk[t.getDay()] + '요일</span><span class="mc-d">' + t.getDate() + '</span></span>'; }
    return '<span class="mc-app ' + n.g + '" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + GLYPH[n.k] + '</svg></span>';
  }

  /* 메뉴바 시계 */
  var bar = document.querySelector('.top .bar');
  if (bar) {
    var clk = document.createElement('span');
    clk.className = 'mc-clk'; clk.setAttribute('aria-hidden', 'true'); clk.innerHTML = clockHTML();
    bar.appendChild(clk);
    setInterval(function () { clk.innerHTML = clockHTML(); }, 15000);
  }

  /* 상단 메뉴가 한 줄에 다 들어가는지 실제 폭으로 재서, 안 들어가면 메뉴를 아래 줄로 내린다(줄바꿈되어 전부 보임).
   * 한 줄 상태로 되돌려 재고(메뉴가 잘리는지: scrollWidth > clientWidth) 결과에 따라 mc-wrap 을 붙이거나 뗀다. */
  var navEl0 = document.getElementById('nav'), raf = 0, lastW = -1;
  function fitBar() {
    if (!bar || !navEl0 || !bar.offsetWidth) return;                    // 비밀번호 화면 등으로 보이지 않을 때는 건너뜀
    bar.classList.remove('mc-wrap');
    bar.classList.toggle('mc-wrap', navEl0.scrollWidth > navEl0.clientWidth + 1);
  }
  function scheduleFit() { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitBar); }
  if (bar) {
    addEventListener('resize', scheduleFit);
    if (window.ResizeObserver) new ResizeObserver(function () { var w = bar.offsetWidth; if (w !== lastW) { lastW = w; scheduleFit(); } }).observe(bar);   // 입장 후 처음 보일 때·폭이 바뀔 때
    if (navEl0 && window.MutationObserver) new MutationObserver(scheduleFit).observe(navEl0, { childList: true });                              // 화면이 바뀌어 메뉴가 다시 그려질 때
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFit);                                                         // 글꼴이 늦게 로드되면 글자 폭이 달라진다
    scheduleFit();
  }

  /* 스크롤하면 메뉴바를 어두운 유리로 (맨 위에서는 투명) */
  var top = document.querySelector('.top');
  if (top) {
    var sc = function () { top.classList.toggle('mc-scrolled', scrollY > 8); };
    addEventListener('scroll', sc, { passive: true }); sc();
  }

  /* Dock */
  var dock = document.createElement('div');
  dock.className = 'mc-dock'; dock.setAttribute('role', 'navigation'); dock.setAttribute('aria-label', '바로가기');
  dock.innerHTML = NAV.map(function (n) {
    return '<a class="mc-it" href="' + n.href + '" data-k="' + n.k + '">' + iconHTML(n) + '<i></i><em>' + n.label + '</em></a>';
  }).join('');
  document.body.appendChild(dock);

  function mark() {          // 지금 보고 있는 화면의 아이콘 아래에 점을 찍는다
    var h = location.hash || '#/', k = 'home';
    if (h.indexOf('#/list') === 0) k = 'list'; else if (h.indexOf('#/personal') === 0) k = 'personal';
    else if (h.indexOf('#/applicant') === 0) k = 'detail'; else if (h.indexOf('#/schedule') === 0) k = 'schedule';
    else if (h.indexOf('#/interview') === 0) k = 'interview'; else if (h.indexOf('#/guide') === 0) k = 'guide';
    [].forEach.call(dock.querySelectorAll('.mc-it'), function (a) {
      if (a.getAttribute('data-k') === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  // js/app.js 는 화면 이동 링크를 직접 가로채 history.pushState 로 주소만 바꾸는데, pushState 는 hashchange 를 일으키지 않는다.
  // 그래서 화면이 그려질 때마다 메뉴(#nav)가 다시 만들어지는 것을 지켜보고(MutationObserver), 그때마다 표시를 맞춘다.
  addEventListener('hashchange', mark); addEventListener('popstate', mark);
  var navEl = document.getElementById('nav');
  if (navEl && window.MutationObserver) new MutationObserver(mark).observe(navEl, { childList: true });
  document.addEventListener('click', function () { setTimeout(mark, 0); });
  mark();

  /* Dock 확대·이름 말풍선
   *  - 마우스(PC): 가까운 아이콘이 커지고 옆 아이콘이 밀려나며 Dock 전체가 함께 커진다. (CSS :hover 가 이름 말풍선을 띄운다)
   *  - 터치(폰·태블릿): 아이콘을 누르면 이름 말풍선이 뜨며 살짝 떠오르고, 손가락을 밀면 PC처럼 커진다.
   *    누르기만 한 경우(탭)에는 아이콘이 밀리지 않아 눌림이 빗나가지 않고 그대로 이동한다.
   *    밀다가 놓으면 말풍선이 떠 있던 아이콘의 화면으로 이동한다.
   *  - 가장 크게 커져도 원래 크기의 MAX_SCALE 배까지만, 그리고 Dock 폭이 화면 폭을 넘지 않는 범위까지만 커진다. */
  var MAX_SCALE = 1.45, REACH = 110;          // 상한 배율, 손가락·마우스가 영향을 주는 거리(px). 너무 크면 MAX_SCALE 을 낮춘다
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var its = [].slice.call(dock.querySelectorAll('.mc-it')), base = 0, restW = 0;

  function measure() { base = its[0].querySelector('.mc-app').offsetWidth; restW = dock.getBoundingClientRect().width; }
  function weights(x) {
    return its.map(function (it) {
      var r = it.getBoundingClientRect(), d = Math.abs(x - (r.left + r.width / 2));
      return d < REACH ? Math.cos((d / REACH) * Math.PI / 2) : 0;             // 가까울수록 1, 멀어지면 0
    });
  }
  function grow(x) {
    if (reduce) return weights(x);
    var ws = weights(x), sum = ws.reduce(function (a, b) { return a + b; }, 0);
    var want = base * (MAX_SCALE - 1) * sum, room = Math.max(0, window.innerWidth - 12 - restW);
    var k = want > room && want > 0 ? room / want : 1;                         // 화면 폭을 넘지 않게 확대 폭을 줄인다
    ws.forEach(function (w, i) { its[i].querySelector('.mc-app').style.setProperty('--sz', (base * (1 + (MAX_SCALE - 1) * w * k)).toFixed(1) + 'px'); });
    return ws;
  }
  function resetSizes() { its.forEach(function (it) { it.querySelector('.mc-app').style.removeProperty('--sz'); }); }

  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    if (!reduce) {                                                              // PC: 마우스를 올리면 커진다
      dock.addEventListener('mouseenter', measure);
      dock.addEventListener('mousemove', function (e) { if (!base) measure(); grow(e.clientX); });
      dock.addEventListener('mouseleave', resetSizes);
    }
  } else {                                                                      // 터치
    var down = false, dragging = false, startX = 0, tipIt = null, timer = 0, suppress = false;
    function tip(it) {
      its.forEach(function (x) { x.classList.toggle('mc-tip', x === it); });
      tipIt = it;
      if (!it) return;
      var em = it.querySelector('em'); em.style.setProperty('--mc-tx', '0px');          // 말풍선이 화면 밖으로 나가면 안쪽으로 밀어 넣는다
      var r = em.getBoundingClientRect(), m = 8, dx = r.left < m ? m - r.left : (r.right > window.innerWidth - m ? window.innerWidth - m - r.right : 0);
      em.style.setProperty('--mc-tx', dx + 'px');
    }
    function nearest(ws) { var b = -1, bw = 0.3; ws.forEach(function (w, i) { if (w > bw) { bw = w; b = i; } }); return b < 0 ? null : its[b]; }
    function clear() { tip(null); resetSizes(); dragging = false; }
    dock.addEventListener('pointerdown', function (e) {
      clearTimeout(timer); down = true; dragging = false; startX = e.clientX; measure();
      tip(e.target.closest ? e.target.closest('.mc-it') : null);                       // 누르자마자 이름 말풍선
    });
    dock.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (!dragging && Math.abs(e.clientX - startX) > 8) dragging = true;               // 손가락을 밀기 시작하면 PC처럼 커진다
      if (dragging) tip(nearest(grow(e.clientX)));
    });
    dock.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (dragging && tipIt) {                                                          // 밀다가 놓으면 말풍선이 떠 있던 화면으로 이동
        suppress = true; setTimeout(function () { suppress = false; }, 400);
        location.hash = tipIt.getAttribute('href');
      }
      timer = setTimeout(clear, 650);                                                   // 탭이면 말풍선을 잠깐 보여 준 뒤 사라진다
    });
    dock.addEventListener('pointercancel', function () { down = false; clearTimeout(timer); clear(); });
    dock.addEventListener('click', function (e) { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; } }, true);
    dock.addEventListener('contextmenu', function (e) { e.preventDefault(); });         // 길게 눌러도 링크 미리보기 메뉴가 뜨지 않게
  }
})();
