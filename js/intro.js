/* 입장 인트로(모션그래픽)
 * - 비밀번호로 입장한 직후 사이트 위에 한 번 재생된다. (같은 탭에서 다시 열면 건너뜀: sessionStorage)
 * - 아래 "Skip intro"(또는 Esc)로 언제든 건너뛰고, 끝까지 보면 저절로 사이트가 나타난다.
 * - 데이터는 사이트와 같은 window.APPLICANTS · window.SCHEDULE (입장 후에만 복호화되어 있으므로 개인정보가 밖으로 나가지 않는다).
 * - 빼려면 index.html 에서 css/intro.css · js/intro.js 두 줄을 지우면 된다. 스타일은 css/intro.css. */
(function () {
  'use strict';
  var SEEN = 'opn_intro';                      // 이번 탭에서 이미 봤는지
  var ENTER_LABEL = 'Skip intro';                // 오른쪽 아래 건너뛰기 버튼 문구
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var toD = function (s) { return s ? new Date(s + 'T00:00:00') : null; };
  var md = function (s) { var d = toD(s); return (d.getMonth() + 1) + '.' + pad(d.getDate()); };
  var mdw = function (s) { return md(s) + '(' + WD[toD(s).getDay()] + ')'; };

  function build() {
    var A = window.APPLICANTS || [], S = window.SCHEDULE || { stages: [], slots: [], interviewees: [] };
    var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
    var days = function (s) { return Math.round((toD(s) - TODAY) / 864e5); };
    var status = function (st) {
      if (!st.start) return 'next';
      var e = toD(st.end || st.start), s = toD(st.start);
      if (e < TODAY) return 'done';
      return s <= TODAY ? 'now' : 'next';
    };
    var byName = function (n) { return A.filter(function (a) { return a.name === n; })[0]; };
    var count = function (f) { return A.filter(f).length; };
    var sub = function (k) { return count(function (a) { return a.docs && (a.docs[k] === 'O' || a.docs[k] === '△'); }); };
    var inter = (S.interviewees || []).map(byName).filter(Boolean);
    var slotOf = function (a) { return (S.slots || []).filter(function (x) { return x.name === a.name; })[0]; };
    var minutes = (S.interview && S.interview.minutes) || 30;
    var addMin = function (t, m) { var p = String(t).split(':'), v = +p[0] * 60 + +p[1] + m; return pad(Math.floor(v / 60) % 24) + ':' + pad(v % 60); };

    // 면접: 경력·신입별 날짜 (면접 일정표 slots + 지원자 구분)
    var by = {}, order = [];
    (S.slots || []).forEach(function (x) {
      var a = byName(x.name); if (!a) return;
      if (!by[a.type]) { by[a.type] = []; order.push(a.type); }
      by[a.type].push({ a: a, x: x });
    });
    order.sort(function (p, q) { return ['경력', '신입'].indexOf(p) - ['경력', '신입'].indexOf(q); });
    var groups = order.map(function (t) {
      var L = by[t].sort(function (p, q) { return (p.x.date + p.x.time).localeCompare(q.x.date + q.x.time); });
      var first = L[0].x, last = L[L.length - 1].x;
      return { label: t, date: first.date, when: mdw(first.date) + ' ' + first.time + (L.length > 1 && !last.startOnly ? ' ~ ' + addMin(last.time, minutes) : ''),
        people: L.map(function (p) { return p.a.name + ' · ' + p.x.time; }) };
    });

    var stages = S.stages.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.st = status(s); return o; });
    var sts = stages.map(function (s) { return s.st; });
    var nowIdx = sts.lastIndexOf('now'); if (nowIdx < 0) nowIdx = Math.max(0, sts.lastIndexOf('done'));
    var cur = stages[nowIdx] || {};
    var dd = function (n) { return n === 0 ? 'D-Day' : (n > 0 ? 'D-' : 'D+') + Math.abs(n); };
    var mark = function (id) {
      return '<svg class="mo-mark mo-a mo-pop" viewBox="0 0 72 72" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="mo-g' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#667648"/><stop offset="1" stop-color="#4b5b34"/></linearGradient></defs>' +
        '<circle cx="36" cy="36" r="34.5" fill="url(#mo-g' + id + ')"/><circle class="mo-ring" cx="36" cy="36" r="34.2" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.6" transform="rotate(-90 36 36)"/>' +
        '<g fill="#fff" font-size="23" font-weight="600" text-anchor="middle" letter-spacing="2.5"><text x="37.2" y="33">OP</text><text x="37.2" y="56">NS</text></g></svg>';
    };
    var cnt = function (to, at, pre, shown) { return '<span class="mo-cnt" data-to="' + to + '" data-at="' + at + '"' + (pre ? ' data-pre="' + pre + '"' : '') + '>' + shown + '</span>'; };

    // 장면: [이름, 길이(초), HTML]
    var SC = [];
    SC.push(['인트로', 5.5, '<div class="mo-sc mo-s1">' + mark(1) +
      '<p class="mo-ey mo-a" style="--d:.7s">Openness Studio</p><p class="mo-h mo-a" style="--d:.95s">2026 하반기 채용</p>' +
      '<p class="mo-lead mo-a" style="--d:1.25s">조경 디자이너 · 인사팀 → 실무팀 공유용</p></div>']);
    SC.push(['지원 현황', 6.5, '<div class="mo-sc mo-s2"><p class="mo-ey mo-a">지원 현황</p><p class="mo-h mo-a" style="--d:.15s">숫자로 보는 지원자</p><div class="mo-kpis">' +
      [[A.length, '총 지원자', 1], [count(function (a) { return a.type === '신입'; }), '신입', 2], [count(function (a) { return a.type === '경력'; }), '경력', 3], [count(function (a) { return !!a.master; }), '석사 이상', 4]].map(function (k, i) {
        return '<div class="mo-k mo-t' + k[2] + ' mo-a mo-pop" style="--d:' + (.5 + i * .15) + 's"><span class="mo-n">' + cnt(k[0], 700 + i * 150, '', k[0]) + '<small>명</small></span><span class="mo-l">' + k[1] + '</span></div>';
      }).join('') + '</div><p class="mo-note mo-a" style="--d:1.5s">제출 서류 · 포트폴리오 ' + sub('portfolio') + '/' + A.length + ' · 이력서 ' + sub('resume') + '/' + A.length + ' · 자기소개서 ' + sub('coverLetter') + '/' + A.length + '</p></div>']);
    var p = stages.length > 1 ? nowIdx / (stages.length - 1) : 0;
    SC.push(['전형 일정', 8, '<div class="mo-sc mo-s3"><p class="mo-ey mo-a">전형 일정</p><p class="mo-h mo-a" style="--d:.15s">' +
      (cur.st === 'now' ? '지금은 <em>' + esc(cur.label) + '</em> 단계' : '다음은 <em>' + esc(cur.label) + '</em>') + '</p>' +
      '<div class="mo-tl" style="--p:' + p.toFixed(3) + '"><div class="mo-rail"><span class="mo-fill"></span></div><div class="mo-steps">' +
      stages.map(function (s, i) {
        var dt = s.start ? (s.end && s.end !== s.start ? md(s.start) + ' ~ ' + md(s.end) : md(s.start)) : '일정 미정';
        return '<div class="mo-step mo-' + s.st + ' mo-a mo-pop" style="--d:' + (.5 + i * .18) + 's"><span class="mo-dot">' + (s.st === 'done' ? '✓' : i + 1) + '</span>' +
          '<span class="mo-sl">' + esc(s.label) + '</span><span class="mo-dt">' + dt + '</span><span class="mo-chip">' + { done: '완료', now: '진행 중', next: '예정' }[s.st] + '</span></div>';
      }).join('') + '</div></div></div>']);
    if (groups.length) SC.push(['면접 일정', 7.5, '<div class="mo-sc mo-s4"><p class="mo-ey mo-a">면접 일정</p><p class="mo-h mo-a" style="--d:.15s">' +
      (groups.length > 1 ? '경력과 신입, 따로 만나요' : '면접 일정') + '</p><div class="mo-split">' +
      groups.map(function (g, i) {
        var n = days(g.date), past = n < 0;
        return '<div class="mo-g ' + (g.label === '경력' ? 'mo-e' : 'mo-n2') + (past ? ' mo-past' : '') + ' mo-a ' + (i ? 'mo-fr' : 'mo-fl') + '" style="--d:' + (.55 + i * .2) + 's">' +
          '<span class="mo-tag">' + esc(g.label) + '</span><span class="mo-st">' + (n === 0 ? '오늘' : past ? '면접 완료' : '예정') + '</span>' +
          '<span class="mo-dd" aria-label="' + (n === 0 ? '오늘' : Math.abs(n) + '일 ' + (past ? '지남' : '남음')) + '">' + (n === 0 ? 'D-Day' : cnt(Math.abs(n), 1000 + i * 200, past ? 'D+' : 'D-', dd(n))) + '</span>' +
          '<p class="mo-when">' + esc(g.when) + '</p><div class="mo-who">' + g.people.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div>';
      }).join('') + '</div></div>']);
    if (inter.length) SC.push(['면접 대상자', 8.5, '<div class="mo-sc mo-s5"><p class="mo-ey mo-a">면접 대상자</p><p class="mo-h mo-a" style="--d:.15s">' + inter.length + '명을 만나요</p><div class="mo-cards">' +
      inter.map(function (a, i) {
        var sl = slotOf(a);
        return '<div class="mo-card mo-a mo-flip" style="--d:' + (.55 + i * .22) + 's"><div class="mo-face">' + (a.face ? '<img src="' + esc(a.face) + '" alt="">' : '<span>' + esc(a.name.charAt(0)) + '</span>') + '</div>' +
          '<p class="mo-nm">' + esc(a.name) + '</p><span class="mo-ty' + (a.type === '경력' ? ' mo-e' : '') + '">' + esc(a.type) + '</span>' +
          '<p class="mo-hl">' + esc(a.profile ? a.profile.headline : '') + '</p><p class="mo-tm">' + (sl ? esc(mdw(sl.date) + ' ' + sl.time) : '') + '</p></div>';
      }).join('') + '</div></div>']);
    SC.push(['마무리', 5, '<div class="mo-sc mo-s6">' + mark(2) + '<p class="mo-h mo-a" style="--d:.35s">자세한 내용은<br>채용 현황 페이지에서</p><div class="mo-menu">' +
      ['현황', '지원자 목록', '인적사항', '지원자 상세', '전형 일정', '면접 대상자'].map(function (m, i) { return '<span class="mo-a" style="--d:' + (.8 + i * .08) + 's">' + m + '</span>'; }).join('') + '</div></div>']);
    return SC;
  }

  function open() {
    var SC = build();
    var root = document.createElement('div');
    root.id = 'mo'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '2026 하반기 채용 소개');
    root.innerHTML = '<div class="mo-bg"></div><div class="mo-shade"></div>' +
      '<div class="mo-view"><div class="mo-stage">' + SC.map(function (s) { return s[2]; }).join('') + '</div></div>' +
      '<div class="mo-ctl"><div class="mo-bar">' +
        '<button type="button" class="mo-btn" data-act="prev" aria-label="이전 장면"><svg viewBox="0 0 24 24"><path d="M15.5 5.5L9 12l6.5 6.5-1.6 1.6L5.8 12l8.1-8.1z"/></svg></button>' +
        '<button type="button" class="mo-btn" data-act="play" aria-label="일시정지"></button>' +
        '<div class="mo-segs">' + SC.map(function (s, i) { return '<button type="button" class="mo-seg" data-i="' + i + '" aria-label="' + (i + 1) + '번째 장면: ' + s[0] + '"><span class="mo-lb">' + s[0] + '</span><span class="mo-tr"><span></span></span></button>'; }).join('') + '</div>' +
        '<button type="button" class="mo-btn" data-act="next" aria-label="다음 장면"><svg viewBox="0 0 24 24"><path d="M8.5 5.5L15 12l-6.5 6.5 1.6 1.6 8.1-8.1-8.1-8.1z"/></svg></button>' +
        '<button type="button" class="mo-enter" data-act="enter">' + ENTER_LABEL + ' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button>' +
      '</div></div>' +
      '<p class="mo-sr" aria-live="polite"></p>';

    // 뒤의 사이트는 인트로가 떠 있는 동안 건드릴 수 없게 (화면 낭독·키보드 포함)
    var behind = [].filter.call(document.body.children, function (el) { return el !== root && el.tagName !== 'SCRIPT'; });
    behind.forEach(function (el) { el.setAttribute('inert', ''); });
    document.documentElement.classList.add('mo-open');
    document.body.appendChild(root);

    var stage = root.querySelector('.mo-stage'), view = root.querySelector('.mo-view');
    var els = [].slice.call(root.querySelectorAll('.mo-sc')), segs = [].slice.call(root.querySelectorAll('.mo-seg'));
    var playBtn = root.querySelector('[data-act=play]'), live = root.querySelector('.mo-sr');
    var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    var idx = 0, t = 0, last = 0, playing = !reduce, closed = false, raf = 0;
    var ICON = { pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>', play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z"/></svg>' };

    function fit() {                                              // 무대 높이는 가로 810 / 세로 1400 고정, 폭은 화면 비율을 따라 넓혀(가로 1440~1800, 세로 780~980) 빈 여백 없이 크게 맞춘다
      var W = view.clientWidth, H = view.clientHeight, P = W / H < 0.9;
      root.classList.toggle('mo-P', P);
      var h0 = P ? 1400 : 810, w0 = Math.max(P ? 780 : 1440, Math.min(P ? 980 : 1800, h0 * W / H));
      stage.style.width = w0 + 'px'; stage.style.height = h0 + 'px';
      var s = Math.min(W / w0, H / h0);
      stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    }
    function setPlay(v) { playing = v; root.classList.toggle('mo-paused', !v); playBtn.innerHTML = v ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', v ? '일시정지' : '재생'); }
    function go(i) {
      i = Math.max(0, Math.min(els.length - 1, i));
      els.forEach(function (el) { el.classList.remove('mo-on'); el.setAttribute('aria-hidden', 'true'); });
      void stage.offsetWidth;                                     // 애니메이션을 처음부터 다시 시작
      idx = i; t = 0;
      els[idx].classList.add('mo-on'); els[idx].removeAttribute('aria-hidden');
      segs.forEach(function (s, k) { s.classList.toggle('mo-cur', k === idx); s.querySelector('.mo-tr span').style.width = k < idx ? '100%' : '0'; });
      live.textContent = (idx + 1) + '/' + els.length + ' ' + SC[idx][0];
    }
    function nav(i) { go(i); if (!reduce && !playing) setPlay(true); }   // 멈춘 채 넘기면 장면이 첫 프레임(빈 화면)에 머무르므로 다시 재생
    var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    function paint() {
      segs[idx].querySelector('.mo-tr span').style.width = Math.min(100, t / (SC[idx][1] * 1000) * 100) + '%';
      [].forEach.call(els[idx].querySelectorAll('.mo-cnt'), function (c) {     // 숫자 세기: 장면 시간에 맞춰 올라가 일시정지하면 함께 멈춘다
        var x = reduce ? 1 : Math.max(0, Math.min(1, (t - +c.getAttribute('data-at')) / 1300));
        c.textContent = (c.getAttribute('data-pre') || '') + Math.round(+c.getAttribute('data-to') * ease(x));
      });
    }
    function frame(now) {
      if (closed) return;
      var dt = last ? Math.min(100, now - last) : 0; last = now;
      if (playing) {
        t += dt;
        if (t >= SC[idx][1] * 1000) { if (idx === els.length - 1) { close(); return; } go(idx + 1); }   // 끝까지 보면 사이트로
      }
      paint(); raf = requestAnimationFrame(frame);
    }
    function close() {
      if (closed) return; closed = true; cancelAnimationFrame(raf);
      try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* 저장 불가 환경 */ }
      removeEventListener('resize', fit); removeEventListener('keydown', onKey);
      behind.forEach(function (el) { el.removeAttribute('inert'); });
      document.documentElement.classList.remove('mo-open');
      root.classList.add('mo-out');
      setTimeout(function () { root.remove(); var m = document.getElementById('app'); if (m) m.focus({ preventScroll: true }); }, reduce ? 0 : 600);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') nav(idx + 1);
      else if (e.key === 'ArrowLeft') nav(idx - 1);
      else if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); setPlay(!playing); }
      else if (e.key === 'Tab') {                                 // 초점이 인트로 밖으로 나가지 않게
        var f = [].slice.call(root.querySelectorAll('button')), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'enter') close(); else if (act === 'play') setPlay(!playing);
      else if (act === 'prev') nav(idx - 1); else if (act === 'next') nav(idx + 1);
      else if (b.classList.contains('mo-seg')) nav(+b.getAttribute('data-i'));
    });
    addEventListener('resize', fit); addEventListener('keydown', onKey);
    fit(); setPlay(playing); go(0);
    root.querySelector('.mo-enter').focus({ preventScroll: true });
    raf = requestAnimationFrame(frame);
    window.OPN_INTRO = { go: go, play: setPlay, close: close, seek: function (ms) { t = ms; } };   // 확인용
  }

  /* 언제 띄울까: 비밀번호로 입장하는 순간(body 의 locked 가 빠질 때). 비밀번호 화면이 없는 사본에서는 바로. 같은 탭에서 한 번만 */
  function seen() { try { return !!sessionStorage.getItem(SEEN); } catch (e) { return false; } }
  function start() { if (!seen() && window.APPLICANTS && window.SCHEDULE) open(); }
  window.OPN_INTRO_REPLAY = function () { try { sessionStorage.removeItem(SEEN); } catch (e) {} start(); };   // 다시 보기(필요하면 버튼에 연결)
  if (document.body.classList.contains('locked')) {
    var mo = new MutationObserver(function () {
      if (!document.body.classList.contains('locked')) { mo.disconnect(); setTimeout(start, 60); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } else {
    start();
  }
})();
