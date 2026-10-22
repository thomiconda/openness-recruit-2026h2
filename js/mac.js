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
  addEventListener('hashchange', mark); mark();

  /* 마우스가 있는 기기에서만 Dock 아이콘이 커진다 (터치·"동작 줄이기" 설정에서는 끈다)
   * 마우스 가까이 있는 아이콘이 커지고 옆 아이콘은 밀려나며 Dock 전체가 함께 커진다.
   * 가장 크게 커져도 원래 크기의 MAX_SCALE 배까지만 커진다. (너무 크면 이 값을 낮춘다) */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    var MAX_SCALE = 1.45, REACH = 110;         // 상한 배율, 마우스가 영향을 주는 거리(px)
    var its = [].slice.call(dock.querySelectorAll('.mc-it')), base = 0;
    dock.addEventListener('mouseenter', function () { base = its[0].querySelector('.mc-app').offsetWidth; });   // 평소 크기
    dock.addEventListener('mousemove', function (e) {
      if (!base) base = its[0].querySelector('.mc-app').offsetWidth;
      its.forEach(function (it) {
        var r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
        var f = d < REACH ? Math.cos((d / REACH) * Math.PI / 2) : 0;      // 가까울수록 1, 멀어지면 0
        it.querySelector('.mc-app').style.setProperty('--sz', (base * (1 + (MAX_SCALE - 1) * f)).toFixed(1) + 'px');
      });
    });
    dock.addEventListener('mouseleave', function () {
      its.forEach(function (it) { it.querySelector('.mc-app').style.removeProperty('--sz'); });
    });
  }
})();
