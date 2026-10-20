/* 오픈니스 스튜디오 2026 하반기 채용 현황
 * 데이터: data/applicants.js (window.APPLICANTS)
 * 화면 전환: 주소 해시(#/ , #/list, ...). file:// 에서도 동작하도록 모듈·fetch를 쓰지 않는다. */
(function () {
  'use strict';
  var A = window.APPLICANTS || [];
  var app = document.getElementById('app');
  var nav = document.getElementById('nav');

  var ROUTES = [
    { path: '', label: '현황' },
    { path: 'list', label: '지원자 목록' },
    { path: 'personal', label: '인적사항' },
    { path: 'applicant', label: '지원자 상세' },
    { path: 'schedule', label: '전형 일정' },
    { path: 'interview', label: '면접 대상자' },
    { path: 'guide', label: '안내' }
  ];

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nameOf(a) { return a.name.replace(/\s*\n\s*/g, ' '); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateOf(a) { return a.appliedAt.slice(5).replace('-', '.'); }
  function count(fn) { return A.filter(fn).length; }
  function submitted(k) { return count(function (a) { return a.docs[k] === 'O' || a.docs[k] === '△'; }); } // △도 제출로 집계

  /* ---------- 경력 개월 계산 ----------
   * 근무 기간 문자열(예: "2022.02 ~ 2023.09")에서 개월 수를 계산한다.
   * - 시작·종료의 연·월이 모두 있어야 계산한다. (연도만 있으면 계산하지 않고 '–')
   * - 입사월과 퇴사월을 모두 포함해 센다. (2022.02 ~ 2023.09 = 20개월)
   * - '현재' / '재직 중' / 종료 없음은 기준월(REF)까지 계산한다.
   * - 쉼표로 여러 기간이 있으면 합산한다. 총 경력은 겹치는 기간을 한 번만 센다. */
  var REF_Y = 2026, REF_M = 9;
  function parseSeg(s) {
    var m = s.trim().match(/^(\d{4})\.(\d{1,2})\s*~\s*(?:(\d{4})\.(\d{1,2})|현재|재직\s*중)?$/);
    if (!m) return null;
    var a = +m[1] * 12 + (+m[2] - 1);
    var b = m[3] ? +m[3] * 12 + (+m[4] - 1) : REF_Y * 12 + (REF_M - 1);
    return b < a ? null : [a, b];
  }
  function rangesOf(period) {
    var segs = String(period || '').split(',').map(parseSeg);
    return segs.length && segs.every(Boolean) ? segs : null;
  }
  function monthsOf(period) {
    var r = rangesOf(period);
    return r ? r.reduce(function (s, x) { return s + (x[1] - x[0] + 1); }, 0) : null;
  }
  function fmtMonths(m) {
    if (m == null) return '–';
    var y = Math.floor(m / 12), r = m % 12;
    return y && r ? y + '년 ' + r + '개월' : y ? y + '년' : r + '개월';
  }
  /* 경력별 예외 (data/profiles.json 의 career 항목에 지정)
   * - counted:false  조경설계와 무관한 경력. 경력 기간은 '–'로 표시하고 총 경력에 넣지 않는다.
   * - estimate:true  연도만 적혀 있어 월을 알 수 없는 경력. 연도 차이로 계산하고 '추정'으로 표시한다.
   *                  (2019 ~ 2023 = 4년, '현재'는 기준 연도 REF_Y 까지) */
  function yearRange(period) {
    var m = String(period || '').trim().match(/^(\d{4})\s*~\s*(?:(\d{4})|현재|재직\s*중)?$/);
    if (!m) return null;
    var s = +m[1] * 12, e = (m[2] ? +m[2] : REF_Y) * 12 - 1;
    return e < s ? null : [[s, e]];
  }
  function entryRanges(x) {                      // null = 계산 불가
    if (x.counted === false) return [];
    return x.estimate ? yearRange(x.period) : rangesOf(x.period);
  }
  function entryMonths(x) {                      // null = '–'
    if (x.counted === false) return null;
    var r = entryRanges(x);
    return r ? r.reduce(function (s, y) { return s + (y[1] - y[0] + 1); }, 0) : null;
  }
  function entryText(x) {
    var m = entryMonths(x);
    return m == null ? '–' : fmtMonths(m) + (x.estimate ? ' <em class="est">추정</em>' : '');
  }
  function careerTotal(a) {                      // { m: 개월, est: 추정 포함 여부 } 또는 null
    var c = (a.profile && a.profile.career) || [], all = [], est = false, used = 0;
    for (var i = 0; i < c.length; i++) {
      if (c[i].counted === false) continue;      // 조경설계와 무관한 경력은 합산하지 않는다
      var r = entryRanges(c[i]);
      if (!r) return null;                       // 하나라도 계산이 안 되면 총 경력도 '–'
      all = all.concat(r); used++;
      if (c[i].estimate) est = true;
    }
    if (!used) return null;
    all.sort(function (x, y) { return x[0] - y[0]; });
    var tot = 0, cs = all[0][0], ce = all[0][1];
    for (var j = 1; j < all.length; j++) {
      if (all[j][0] <= ce) { ce = Math.max(ce, all[j][1]); }
      else { tot += ce - cs + 1; cs = all[j][0]; ce = all[j][1]; }
    }
    return { m: tot + (ce - cs + 1), est: est };
  }
  function totalText(a) {
    var t = careerTotal(a);
    return t ? fmtMonths(t.m) + (t.est ? ' <em class="est">(추정)</em>' : '') : '–';
  }

  /* ---------- 아바타 (얼굴 사진이 없으면 이름 첫 글자) ---------- */
  function avatar(a, size) {
    var s = size || 36;
    if (a.face) return '<img class="av" src="' + esc(a.face) + '" alt="" width="' + s + '" height="' + s + '" loading="lazy">';
    return '<span class="av in" style="width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * 0.42) + 'px" aria-hidden="true">' + esc(nameOf(a).charAt(0)) + '</span>';
  }

  /* ---------- 공통 조각 ---------- */
  function row(a) {
    var sub = a.profile ? a.profile.headline : '';
    return '<a class="row" href="#/applicant/' + a.no + '">' +
      '<span class="no">' + pad(a.no) + '</span>' +
      '<img src="' + esc(a.thumb) + '" alt="" loading="lazy" width="96" height="64">' +
      '<div><div class="nm">' + avatar(a, 28) + '<span>' + esc(nameOf(a)) + '</span></div><div class="sub">' + esc(sub) + '</div></div>' +
      '<span class="tag">' + esc(a.type) + ' · ' + dateOf(a) + '</span>' +
      '<span class="arrow" aria-hidden="true">→</span></a>';
  }
  function soon(title, desc) {
    return '<h1>' + title + '<small>' + desc + '</small></h1>' +
      '<div class="soon"><b>준비 중입니다</b>이 화면은 다음 단계에서 제공됩니다. <a href="#/">현황으로 돌아가기</a></div>';
  }

  /* ---------- 화면: 현황 ---------- */
  function viewHome() {
    var total = A.length;
    var kpi = [
      [total, '총 지원자'],
      [count(function (a) { return a.type === '신입'; }), '신입'],
      [count(function (a) { return a.type === '경력'; }), '경력'],
      [count(function (a) { return !!a.master; }), '석사 이상']
    ].map(function (k) {
      return '<div class="c"><h3>' + k[1] + '</h3><div class="num">' + k[0] + '<small>명</small></div></div>';
    }).join('');

    // 전형 단계: 지원자 데이터의 stage(1=서류 합격, 2=면접, 3=최종)가 채워지면 자동 집계
    var stages = ['서류 접수', '서류 합격', '면접', '최종'];
    // stage 가 아직 입력되지 않았으면 면접 대상자 수로 서류 합격·면접 단계를 채운다. (전형 일정의 interviewees)
    var targets = interviewees(), hasStage = A.some(function (a) { return a.stage; });
    var steps = stages.map(function (s, i) {
      var c = i === 0 ? total : hasStage ? count(function (a) { return a.stage && a.stage >= i; }) : (i <= 2 ? targets.length : 0);
      return '<div class="st' + (c ? ' on' : '') + '"><b>' + (c || '–') + '</b>' + s + '</div>';
    }).join('');

    var docs = [['포트폴리오', 'portfolio'], ['이력서', 'resume'], ['자기소개서', 'coverLetter']].map(function (d) {
      var n = submitted(d[1]);
      return '<div class="m"><span>' + d[0] + '</span><i><b style="width:' + (n / total * 100) + '%"></b></i><span>' + n + '/' + total + '</span></div>';
    }).join('');

    return '<h1>2026 하반기 채용 현황<small>조경 디자이너 · 실무팀 공유용</small></h1>' +
      '<section class="g g4" aria-label="지원 현황">' + kpi + '</section>' +
      '<section class="g g2">' +
        '<div class="c"><h3>전형 진행</h3><div class="steps">' + steps + '</div></div>' +
        '<div class="c"><h3>제출 서류 현황</h3>' + docs + '<p class="fn">△는 포트폴리오 등에 포함해 제출한 경우로 제출에 포함해 집계했습니다.</p></div>' +
      '</section>' +
      '<h2>면접 대상자 <a href="#/interview">전체 ' + targets.length + '명 보기 →</a></h2>' +
      (targets.length ? '<div class="list">' + targets.map(row).join('') + '</div>' : '<div class="empty2">면접 대상자가 확정되면 이곳에 표시됩니다.</div>');
  }

  /* ---------- 화면: 지원자 목록 ---------- */
  var listState = { type: '', q: '', sort: 'no' };
  function listRows() {
    var q = listState.q.trim().toLowerCase();
    var L = A.filter(function (a) {
      return (!listState.type || a.type === listState.type) &&
        (!q || nameOf(a).toLowerCase().indexOf(q) > -1);
    });
    L.sort(function (x, y) {
      if (listState.sort === 'name') return nameOf(x).localeCompare(nameOf(y), 'ko');
      if (listState.sort === 'late') return y.appliedAt.localeCompare(x.appliedAt) || y.no - x.no;
      return x.no - y.no;
    });
    return L;
  }
  function paintList() {
    var L = listRows();
    document.getElementById('cnt').textContent = L.length + '명';
    document.getElementById('rows').innerHTML = L.length ? L.map(row).join('') : '<div class="empty">조건에 맞는 지원자가 없습니다.</div>';
  }
  function viewList() {
    var chips = [['', '전체'], ['신입', '신입'], ['경력', '경력']].map(function (c) {
      return '<button class="chip" type="button" data-type="' + c[0] + '" aria-pressed="' + (listState.type === c[0]) + '">' + c[1] + '</button>';
    }).join('');
    return '<h1>지원자 목록<small>지원 순서(접수번호) 기준 · 이름을 눌러 상세 보기</small></h1>' +
      '<h2 style="margin-top:32px">전체 <small id="cnt"></small></h2>' +
      '<div class="tools">' + chips +
        '<span class="sp"></span>' +
        '<input id="q" type="search" placeholder="이름 검색" aria-label="이름 검색" value="' + esc(listState.q) + '">' +
        '<select id="sort" aria-label="정렬">' +
          '<option value="no"' + (listState.sort === 'no' ? ' selected' : '') + '>접수번호순</option>' +
          '<option value="late"' + (listState.sort === 'late' ? ' selected' : '') + '>최근 지원순</option>' +
          '<option value="name"' + (listState.sort === 'name' ? ' selected' : '') + '>이름순</option>' +
        '</select></div>' +
      '<div class="list" id="rows"></div>';
  }
  function bindList() {
    paintList();
    Array.prototype.forEach.call(app.querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () {
        listState.type = b.getAttribute('data-type');
        Array.prototype.forEach.call(app.querySelectorAll('.chip'), function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        paintList();
      });
    });
    document.getElementById('q').addEventListener('input', function (e) { listState.q = e.target.value; paintList(); });
    document.getElementById('sort').addEventListener('change', function (e) { listState.sort = e.target.value; paintList(); });
  }

  /* ---------- 화면: 인적사항 (전체 비교표 / 선택 비교) ---------- */
  var GROUPS = ['신입', '경력'];
  /* 인적사항 화면과 면접 대상자 화면은 같은 표·비교 화면을 쓴다. 화면마다 대상자·그룹 순서·선택·정렬이 따로 있다.
   * - personal : 전체 지원자 (선택 비교 기본 선택 = 접수번호 4번, 11번)
   * - interview: 전형 일정(data/schedule.js)의 interviewees 순서대로. 경력 → 신입 순으로 묶고 기본 정렬은 그 순서 그대로 */
  var PCTX = {
    personal: { path: 'personal', label: '지원자', groups: ['신입', '경력'], sel: [4, 11], sort: { k: 'x', dir: 1 } },
    interview: { path: 'interview', label: '면접 대상자', groups: ['경력', '신입'], sel: null, sort: { k: null, dir: 1 }, keepOrder: true }
  };
  var pc = PCTX.personal;             // 지금 보고 있는 화면
  function pool() { return pc === PCTX.interview ? interviewees() : A; }
  function poolType(t) { return pool().filter(function (a) { return a.type === t; }); }
  function interviewees() {
    return ((window.SCHEDULE && window.SCHEDULE.interviewees) || []).map(findByName).filter(Boolean);
  }
  function dash(v) { return v && String(v).trim() ? esc(v) : '–'; }
  function ageOf(a) { return a.birthYear ? a.birthYear + '년생 · ' + a.age + '세' : '–'; }
  function badge(a) { return '<span class="badge' + (a.type === '경력' ? ' e' : '') + '">' + esc(a.type) + '</span>'; }
  function mark(v) { return v === 'O' ? '<b class="ok">O</b>' : v === '△' ? '<b class="ok half">△</b>' : '<b class="no-">X</b>'; }
  function docsHtml(a) { return '<span class="docs">' + mark(a.docs.portfolio) + mark(a.docs.resume) + mark(a.docs.coverLetter) + '</span>'; }
  // 최종학력: 석사가 있으면 석사, 없으면 학사. 석사가 있으면 학사는 보조 줄로 표시
  function eduFinal(a) {
    var m = a.master && a.master.trim(), b = a.bachelor && a.bachelor.trim();
    if (m) return '<span class="edu">' + esc(m) + (b ? '<small>학사: ' + esc(b) + '</small>' : '') + '</span>';
    return '<span class="edu">' + dash(b) + '</span>';
  }
  function eduKey(a) { return (a.master || '') + '|' + (a.bachelor || ''); }
  function careerOf(a) { return (a.profile && a.profile.career) || []; }
  // 경력 사항: 근무 기간 · 근무처 · 직책 · 담당 업무 (자료에 없는 항목은 표시하지 않음)
  function careerItems(a) {
    return '<ul class="cr">' + careerOf(a).map(function (x) {
      return '<li><span class="pr">' + esc(x.period) + '<span class="mo">(' + entryText(x) + ')</span></span><div><b>' + esc(x.org) + '</b>' +
        (x.role ? '<span class="rl">' + esc(x.role) + '</span>' : '') +
        (x.desc ? '<p>' + esc(x.desc) + '</p>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }
  // 인적사항(표·카드·비교)에서 쓰는 경력 블록: 총 경력 + 경력별 목록
  function careerHtml(a) {
    if (!careerOf(a).length) return '<ul class="cr none"><li style="display:block">' + (a.type === '경력' ? '–' : '경력 사항 없음') + '</li></ul>';
    return '<div class="tot">총 경력 <b>' + totalText(a) + '</b></div>' + careerItems(a);
  }
  function careerKey(a) { return careerOf(a).map(function (x) { return x.period + x.org + x.role; }).join('|'); }
  function byType(t) { return A.filter(function (a) { return a.type === t; }); }
  function link(a) { return '<a class="nl" href="#/applicant/' + a.no + '">' + avatar(a, 30) + '<span>' + esc(nameOf(a)) + '</span></a>'; }
  function nameOnly(a) { return '<a href="#/applicant/' + a.no + '">' + esc(nameOf(a)) + '</a>'; }

  var COLS = [
    ['이름', link, 'n'], ['구분', badge, 't'], ['출생 · 나이', ageOf, 'y'],
    ['성별', function (a) { return dash(a.gender); }, 'g'],
    ['최종학력', eduFinal, 'b', 'w'],
    ['경력 사항 (근무 기간 · 근무처 · 직책 · 담당 업무)', careerHtml, 'l', 'cc'],
    ['전공', function (a) { return dash(a.major); }, 'j'],
    ['자격증', function (a) { return dash(a.certificates); }, 'c', 'w'],
    ['거주지', function (a) { return dash(a.residence); }, 'r'],
    ['지원일', function (a) { return dateOf(a); }, 'd'],
    ['서류', docsHtml, 'x']
  ];
  var SORTKEY = {
    n: nameOf, t: function (a) { return a.type; }, y: function (a) { return a.birthYear || '9999'; },
    g: function (a) { return a.gender; }, b: eduKey, j: function (a) { return a.major; },
    c: function (a) { return a.certificates; }, r: function (a) { return a.residence; },
    l: function (a) { return careerOf(a).length; }, d: function (a) { return a.appliedAt; }, x: function (a) { return a.no; }
  };
  function sortedBy(L) {
    if (!pc.sort.k) return L.slice();            // 정렬을 고르지 않았으면 목록에 적힌 순서 그대로
    return L.slice().sort(function (p, q) {
      return String(SORTKEY[pc.sort.k](p)).localeCompare(String(SORTKEY[pc.sort.k](q)), 'ko', { numeric: true }) * pc.sort.dir;
    });
  }

  function paintFull() {
    var host = document.getElementById('v-full');
    host.innerHTML = pc.groups.map(function (g) {
      var L = sortedBy(poolType(g));
      if (!L.length) return '';
      var head = COLS.map(function (c) {
        return '<th data-k="' + c[2] + '">' + c[0] + '<span class="s">' + (pc.sort.k === c[2] ? (pc.sort.dir > 0 ? '▲' : '▼') : '') + '</span></th>';
      }).join('');
      var body = L.map(function (a) {
        return '<tr>' + COLS.map(function (c) {
          return '<td' + (c[3] === 'cc' ? ' class="cc"' : c[3] ? ' class="w"' : '') + '>' + c[1](a) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      var cards = L.map(function (a) {
        return '<article class="pc"><div class="ph">' + avatar(a, 52) + '<div><div class="n">' + nameOnly(a) + '</div><div class="s">' + badge(a) + ' ' + ageOf(a) + '</div></div><span class="no">' + pad(a.no) + '</span></div>' +
          '<dl><dt>성별</dt><dd>' + dash(a.gender) + '</dd><dt>최종학력</dt><dd>' + eduFinal(a) + '</dd><dt>전공</dt><dd>' + dash(a.major) + '</dd><dt>자격증</dt><dd>' + dash(a.certificates) + '</dd><dt>거주지</dt><dd>' + dash(a.residence) + '</dd><dt>지원일</dt><dd>' + esc(a.appliedAt) + '</dd><dt>서류</dt><dd class="docs">' + docsHtml(a) + ' <span style="font-size:11px;color:var(--mute)">포·이·자</span></dd></dl>' +
          '<div class="cd"><h5>경력 사항</h5>' + careerHtml(a) + '</div></article>';
      }).join('');
      return '<h2 class="gt">' + g + '<small>' + L.length + '명</small></h2>' +
        '<div class="tw"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
        '<div class="cg">' + cards + '</div>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('th'), function (h) {
      h.addEventListener('click', function () {
        var k = h.getAttribute('data-k');
        pc.sort.dir = pc.sort.k === k ? -pc.sort.dir : 1; pc.sort.k = k; paintFull();
      });
    });
  }

  var ROWS = [
    ['구분', badge, function (a) { return a.type; }],
    ['출생 · 나이', ageOf, function (a) { return a.birthYear; }],
    ['성별', function (a) { return dash(a.gender); }, function (a) { return a.gender; }],
    ['최종학력', eduFinal, eduKey],
    ['전공', function (a) { return dash(a.major); }, function (a) { return a.major; }],
    ['자격증', function (a) { return dash(a.certificates); }, function (a) { return a.certificates; }],
    ['거주지', function (a) { return dash(a.residence); }, function (a) { return a.residence; }],
    ['경력 사항', careerHtml, careerKey],
    ['지원일', function (a) { return esc(a.appliedAt); }, function (a) { return a.appliedAt; }],
    ['서류 (포·이·자)', docsHtml, function (a) { return a.docs.portfolio + a.docs.resume + a.docs.coverLetter; }]
  ];
  function paintPick() {
    document.getElementById('pickgrp').innerHTML = pc.groups.map(function (g) {
      var L = poolType(g), n = L.filter(function (a) { return pc.sel.indexOf(a.no) > -1; }).length;
      return '<div class="pg"><h3>' + g + ' ' + L.length + '명<span><em>' + (n ? n + '명 선택' : '') + '</em></span></h3>' +
        L.map(function (a) {
          return '<button class="pk" type="button" data-n="' + a.no + '" aria-pressed="' + (pc.sel.indexOf(a.no) > -1) + '"><i>' + pad(a.no) + '</i>' + esc(nameOf(a)) + '</button>';
        }).join('') + '</div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.pk'), function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-n'), i = pc.sel.indexOf(n);
        if (i > -1) pc.sel.splice(i, 1);
        else if (pc.sel.length < 4) pc.sel.push(n);
        else { alert('최대 4명까지 선택할 수 있습니다.'); return; }
        paintPick(); paintCmp();
      });
    });
  }
  function paintCmp() {
    var P = pc.keepOrder
      ? pool().filter(function (a) { return pc.sel.indexOf(a.no) > -1; })       // 목록에 적힌 순서 유지
      : pc.sel.map(function (n) { return A.filter(function (a) { return a.no === n; })[0]; });
    var cmp = document.getElementById('cmp'), st = document.getElementById('st');
    if (!P.length) {
      cmp.innerHTML = '<tbody><tr><td class="empty">위에서 비교할 지원자를 선택해 주세요.</td></tr></tbody>';
      st.innerHTML = '<div class="it"><div class="v" style="display:block;text-align:center;color:var(--mute);padding:28px">위에서 비교할 지원자를 선택해 주세요.</div></div>';
      return;
    }
    function differs(r) {
      var s = {}; P.forEach(function (a) { s[String(r[2](a) || '')] = 1; });
      return P.length > 1 && Object.keys(s).length > 1;
    }
    cmp.innerHTML = '<thead><tr><th></th>' + P.map(function (a) {
      return '<th>' + avatar(a, 48) + '<br>' + nameOnly(a) + '<small>' + esc(a.type) + ' · ' + ageOf(a) + '</small></th>';
    }).join('') + '</tr></thead><tbody>' + ROWS.map(function (r) {
      return '<tr class="' + (differs(r) ? 'diff' : '') + '"><td>' + r[0] + '</td>' + P.map(function (a) { return '<td>' + r[1](a) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    st.innerHTML = '<div class="sel">' + P.map(function (a) {
      return '<div class="p">' + avatar(a, 36) + '<div><b>' + esc(nameOf(a)) + '</b><small>' + esc(a.type) + ' · ' + (a.birthYear ? a.age + '세' : '–') + '</small></div></div>';
    }).join('') + '</div>' + ROWS.map(function (r) {
      var d = differs(r);
      return '<section class="it ' + (d ? 'diff' : '') + '"><h4>' + r[0] + (d ? '<em>차이 있음</em>' : '') + '</h4>' +
        P.map(function (a) { return '<div class="v"><span>' + esc(nameOf(a).split(' ')[0]) + '</span><div>' + r[1](a) + '</div></div>'; }).join('') + '</section>';
    }).join('');
  }

  // 기본 보기: 인적사항은 전체 비교표. 면접 대상자는 PC에서 선택 비교, 모바일(720px 이하, CSS 카드 전환 기준)에서 전체 비교표.
  // 주소에 /full 또는 /compare 가 있으면 그 보기를 그대로 쓴다.
  function isMobile() { return !!(window.matchMedia && window.matchMedia('(max-width:720px)').matches); }
  function isCompare(sub) {
    if (sub === 'compare') return true;
    if (sub === 'full') return false;
    return pc === PCTX.interview && !isMobile();
  }
  function viewPersonal(sub) {
    var cmp = isCompare(sub), base = '#/' + pc.path;
    var fullHref = pc === PCTX.interview ? base + '/full' : base, cmpHref = base + '/compare';
    if (!pc.sel) pc.sel = pool().map(function (a) { return a.no; }).slice(0, 4);   // 면접 대상자 화면은 처음에 모두 선택
    var title = pc === PCTX.interview ? '면접 대상자' : '인적사항';
    var sum = pc.label + ' ' + pool().length + '명 · ' + pc.groups.map(function (g) { return g + ' ' + poolType(g).length + '명'; }).join(' / ');
    return '<h1>' + title + '<small>' + sum + '</small></h1>' +
      '<div class="seg" role="tablist"><a role="tab" href="' + fullHref + '" aria-selected="' + !cmp + '">전체 비교표</a><a role="tab" href="' + cmpHref + '" aria-selected="' + cmp + '">선택 비교</a></div>' +
      '<p class="hint">' + (cmp ? '비교할 ' + pc.label + '를 신입·경력 구분 없이 최대 4명까지 골라 항목별로 비교합니다.' : pc.groups.join('·') + ' 그룹별로 모든 ' + pc.label + '를 한 번에 봅니다. (PC: 표 · 모바일: 카드)') + '</p>' +
      (cmp
        ? '<section class="view on cmp"><div class="pickgrp" id="pickgrp"></div><div class="tw"><table id="cmp"></table></div><div class="st-wrap" id="st"></div></section>'
        : '<section class="view on full" id="v-full"></section>');
  }
  function bindPersonal(sub) {
    if (isCompare(sub)) { paintPick(); paintCmp(); } else { paintFull(); }
  }

  /* ---------- 화면: 준비 중 (4단계 이후) ---------- */
  /* ---------- 화면: 지원자 상세 (시안 A: 에디토리얼) ---------- */
  function byNo(no) { return A.filter(function (x) { return String(x.no) === String(no); })[0]; }
  function worksOf(a) { return a.profileImage ? a.images.slice(1) : a.images; }
  function profileOf(a) { return a.profileImage ? a.images[0] : null; }
  function viewChooser() {
    return '<h1>지원자 상세<small>보고 싶은 지원자를 선택해 주세요</small></h1>' +
      GROUPS.map(function (g) {
        return '<h2 class="gt">' + g + '<small>' + byType(g).length + '명</small></h2><div class="chs">' +
          byType(g).map(function (a) {
            return '<a class="ch" href="#/applicant/' + a.no + '">' + avatar(a, 52) + '<span>' + esc(nameOf(a)) + '</span></a>';
          }).join('') + '</div>';
      }).join('');
  }
  // 암호화 배포본: 큰 이미지는 상세 페이지를 열 때 불러와 복호화한다 (window.SECURE_LOADER, js/gate.js)
  function needImages(a) {
    if ((a.images && a.images.length) || !a.imageCount || !window.SECURE_LOADER) return false;
    if (!a._loading && !a._imgFail) {
      a._loading = true;
      var done = function () {
        a._loading = false;
        var r = parse();
        if (r.path === 'applicant' && String(r.arg) === String(a.no)) render();
      };
      window.SECURE_LOADER(a.no).then(function (urls) { a.images = urls; done(); }, function () { a._imgFail = true; done(); });
    }
    return !!a._loading;
  }
  function viewApplicant(no) {
    var a = byNo(no);
    if (!a) return viewChooser();
    var loading = needImages(a);
    var p = a.profile || {}, w = worksOf(a), pf = profileOf(a);
    var facts = [
      ['구분', badge(a)], ['출생 · 나이', ageOf(a)], ['성별', dash(a.gender)],
      ['거주지', dash(a.residence)], ['지원일', esc(a.appliedAt)], ['서류 (포·이·자)', docsHtml(a)]
    ].map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('');
    var idx = A.map(function (x) { return x.no; }).indexOf(a.no);
    var prev = A[idx - 1], next = A[idx + 1];

    var sections = '';
    if (p.statement) {
      sections += '<section class="sec"><div class="lab">Statement</div><h2>지원 동기 · 소개</h2><blockquote class="q">' + esc(p.statement) + '</blockquote></section>';
    }
    sections += '<section class="sec g2c"><div><div class="lab">Education</div><h2>학력</h2><ul class="edu-l">' +
      ((p.education || []).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') || '<li>–</li>') + '</ul>' +
      ((p.highlights || []).length ? '<div style="height:34px"></div><div class="lab">Certificates · Awards</div><h2>자격 · 수상 · 주요 작업</h2><ul class="hl">' +
        p.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
      '</div><div>' +
      ((p.skills || []).length ? '<div class="lab">Skills</div><h2>보유 기술</h2><div class="skills">' + p.skills.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
      '</div></section>';

    sections += '<section class="sec"><div class="lab">Career</div><h2>경력 사항 <span class="tt">총 경력 <b>' + totalText(a) + '</b></span></h2>' +
      (careerOf(a).length
        ? '<ol class="tl">' + careerOf(a).map(function (x) {
            return '<li><span class="pr">' + esc(x.period) + '<span class="mo">(' + entryText(x) + ')</span></span><div class="bd"><b>' + esc(x.org) + '</b>' +
              (x.role ? '<span class="rl">' + esc(x.role) + '</span>' : '') + (x.desc ? '<p>' + esc(x.desc) + '</p>' : '') + '</div></li>';
          }).join('') + '</ol>'
        : '<p class="mute">경력 사항 없음</p>') +
      '<p class="fn">기간은 입사월과 퇴사월을 모두 포함해 계산하고, 재직 중인 곳은 ' + REF_Y + '.' + pad(REF_M) + '까지로 계산했습니다. 총 경력은 겹치는 기간을 한 번만 반영했습니다. 조경설계와 관련 없는 업무는 경력 기간을 –로 표시하고 총 경력에 포함하지 않았습니다. 월 없이 연도만 적힌 기간은 연도 차이로 계산한 값이라 \'추정\'으로 표시하며, 그 밖에 계산할 수 없는 기간은 –로 표시합니다.</p></section>';

    if (loading) {
      sections += '<section class="sec"><p class="mute ldn">이미지를 불러오는 중…</p></section>';
    } else if (a._imgFail) {
      sections += '<section class="sec"><p class="mute">이미지를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</p></section>';
    }
    if (pf) {
      sections += '<section class="sec"><div class="lab">Profile</div><h2>프로필 페이지</h2><figure class="pfig" data-zoom="' + esc(pf) + '"><img src="' + esc(pf) + '" alt="' + esc(nameOf(a)) + ' 프로필 페이지" loading="lazy"><figcaption>눌러서 크게 보기 · 연락처는 가려져 있습니다</figcaption></figure></section>';
    }
    sections += '<section class="sec"><div class="lab">Selected Works</div><h2>대표 작업</h2><div class="gal">' +
      w.map(function (s, i) {
        return '<figure data-zoom="' + esc(s) + '"><img src="' + esc(s) + '" alt="" loading="lazy"><figcaption>작업 ' + (i + 1) + ' / ' + w.length + '</figcaption></figure>';
      }).join('') + '</div></section>';

    return '<div class="wrap">' +
      '<div class="sw"><a class="back" href="#/list">← 지원자 목록</a><span class="bdot" aria-hidden="true">·</span><a class="back" href="#/applicant">← 지원자 상세</a><span class="sp"></span>' +
        (prev ? '<a class="swc" href="#/applicant/' + prev.no + '">← ' + esc(nameOf(prev)) + '</a>' : '') +
        (next ? '<a class="swc" href="#/applicant/' + next.no + '">' + esc(nameOf(next)) + ' →</a>' : '') + '</div>' +
      ((w[0] || pf) ? '<div class="hero"><img src="' + esc(w[0] || pf) + '" alt=""></div>' : '<div class="hero ld"></div>') +
      '<div class="hd">' + avatar(a, 104) + '<div class="hdt"><div class="lab">' + esc(a.type) + ' · ' + pad(a.no) + '</div><h1 class="nm-big">' + esc(nameOf(a)) + '</h1>' +
        '<p class="hl2">' + esc(p.headline || '') + '</p></div></div>' +
      '<dl class="fb">' + facts + '</dl>' + sections +
      '<p class="src">출처: ' + esc(p.sourceNote || '제출 서류 기준') + ' · 제출 서류에 없는 내용은 적지 않았습니다.</p>' +
    '</div>';
  }
  function zoomImg(src) {
    var d = document.createElement('div');
    d.className = 'lb2'; d.innerHTML = '<img src="' + esc(src) + '" alt=""><button type="button" aria-label="닫기">×</button>';
    d.addEventListener('click', function () { d.remove(); });
    document.body.appendChild(d);
  }
  function bindApplicant() {
    Array.prototype.forEach.call(app.querySelectorAll('[data-zoom]'), function (el) {
      el.addEventListener('click', function () { zoomImg(el.getAttribute('data-zoom')); });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var l = document.querySelector('.lb2'); if (l) l.remove(); }
  });

  /* ---------- 화면: 전형 일정 (시안 A: 스텝퍼) ---------- */
  var SCH = window.SCHEDULE || { stages: [], interview: {}, slots: [] };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  function toD(s) { return s ? new Date(s + 'T00:00:00') : null; }
  function mdText(s) { var d = toD(s); return d ? (d.getMonth() + 1) + '.' + pad(d.getDate()) : ''; }
  function mdwText(s) { var d = toD(s); return d ? (d.getMonth() + 1) + '.' + pad(d.getDate()) + '(' + WD[d.getDay()] + ')' : ''; }
  function tent(st) { return st.tentative ? ' (예정)' : ''; }   // 날짜가 확정 전이면 "(예정)" 표시
  // st.text 가 있으면 날짜 대신 그 문장을 표시한다. (경력·신입 면접처럼 날짜가 둘 이상일 때) 상태 계산은 start·end 를 그대로 쓴다.
  function whenText(st) {
    if (st.text) return esc(st.text).replace(/ ~ /g, '\u00a0~\u00a0').replace(/ \/ /g, '<br>') + tent(st);   // 시간 범위는 줄바꿈하지 않는다
    return st.start ? (st.end && st.end !== st.start ? mdText(st.start) + ' ~ ' + mdText(st.end) : mdText(st.start)) + tent(st) : '일정 미정';
  }
  function whenWText(st) {
    if (st.text) return esc(st.text) + tent(st);
    return st.start ? (st.end && st.end !== st.start ? mdwText(st.start) + ' ~ ' + mdwText(st.end) : mdwText(st.start)) + tent(st) : '일정 미정';
  }
  function stageStatus(st) {
    if (!st.start) return 'next';
    var e = toD(st.end || st.start), s = toD(st.start);
    if (e < TODAY) return 'done';
    return s <= TODAY ? 'now' : 'next';
  }
  var STATUS_LABEL = { done: '완료', now: '진행 중', next: '예정' };
  function ddayText(s) {
    var d = toD(s); if (!d) return '';
    var n = Math.round((d - TODAY) / 864e5);
    return n === 0 ? 'D-Day' : n > 0 ? 'D-' + n : 'D+' + (-n);
  }
  function nextStage() {
    return SCH.stages.filter(function (s) { return s.start && toD(s.end || s.start) >= TODAY; })[0] || null;
  }
  function timeRange(t, minutes, startOnly) {      // "10:00" + 30분 -> "10:00 ~ 10:30" (startOnly 면 "10:00 시작")
    var m = String(t).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return esc(t);
    if (startOnly) return pad(+m[1]) + ':' + m[2] + ' 시작';
    var total = +m[1] * 60 + +m[2] + (minutes || 30);
    return pad(+m[1]) + ':' + m[2] + ' ~ ' + pad(Math.floor(total / 60) % 24) + ':' + pad(total % 60);
  }
  function findByName(name) {
    var n = String(name || '').replace(/\s+/g, '');
    return A.filter(function (a) { return nameOf(a).replace(/\s+/g, '') === n; })[0];
  }
  function viewSchedule() {
    var iv = SCH.interview || {};
    var steps = SCH.stages.map(function (s, i) {
      var st = stageStatus(s);
      return '<li class="' + st + '"><span class="dot">' + (st === 'done' ? '✓' : i + 1) + '</span><div><b>' + esc(s.label) + '</b>' +
        '<span class="dt' + (s.start ? '' : ' tbd') + '">' + whenText(s) + '</span>' +
        '<span class="sc chip-s ' + st + '">' + STATUS_LABEL[st] + '</span><p>' + esc(s.desc) + '</p></div></li>';
    }).join('');
    var n = nextStage();
    var now = n ? '<div class="nowc"><span class="chip-s now">다음 일정</span><b>' + esc(n.label) + '</b><span>' + whenWText(n) + '</span><span class="dd">' + ddayText(n.start) + '</span></div>' : '';
    var info = [['장소', iv.place], ['소요 시간', iv.duration || (iv.minutes || 30) + '분 (지원자 1명당)'], ['면접관', iv.panel], ['진행 방식', iv.method]].map(function (r) {
      return '<dt>' + r[0] + '</dt><dd' + (r[1] ? '' : ' class="tbd"') + '>' + (r[1] ? esc(r[1]).replace(/ \/ /g, '<br>') : '미정') + '</dd>';
    }).join('');

    var slots = (SCH.slots || []).slice().sort(function (x, y) { return (x.date + x.time).localeCompare(y.date + y.time); });
    var table;
    if (!slots.length) {
      table = '<div class="empty2">면접 대상자가 확정되면 날짜·시간별 일정표가 이곳에 표시됩니다.</div>';
    } else {
      var g = {}, order = [];
      slots.forEach(function (x) { if (!g[x.date]) { g[x.date] = []; order.push(x.date); } g[x.date].push(x); });
      table = '<div class="days">' + order.map(function (d) {
        return '<div><h3>' + mdwText(d) + ' · ' + g[d].length + '명</h3><table class="ts"><thead><tr><th style="width:150px">시간</th><th>지원자</th><th>구분</th><th>면접관</th></tr></thead><tbody>' +
          g[d].map(function (x) {
            var a = findByName(x.name);
            var who = a ? '<a class="nl" href="#/applicant/' + a.no + '">' + avatar(a, 30) + '<span>' + esc(nameOf(a)) + '</span></a>' : '<b>' + esc(x.name) + '</b>';
            return '<tr><td>' + timeRange(x.time, iv.minutes, x.startOnly) + '</td><td>' + who + '</td><td>' + (a ? esc(a.type) : '–') + '</td><td>' + esc(x.panel || iv.panel || '–') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).join('') + '</div>';
    }
    return '<div class="top-row"><h1>전형 일정<small>서류 접수부터 입사까지 · 날짜는 확정되는 대로 채워집니다</small></h1></div>' +
      '<div class="c stp-card"><ol class="stp">' + steps + '</ol></div>' + now +
      '<h2 style="margin-top:44px">면접 안내</h2><div class="c"><dl class="ci">' + info + '</dl></div>' +
      '<h2 style="margin-top:44px">면접 일정표</h2>' + table;
  }

  /* ---------- 화면: 안내 (채용 공고) ---------- */
  function viewGuide() {
    var G = window.GUIDE || {};
    function stage(key) { return SCH.stages.filter(function (s) { return s.key === key; })[0]; }
    function range(st) { return st ? whenWText(st) : '미정'; }
    var pos = (G.positions || []).map(function (p) {
      return '<article class="pos"><div class="pgh"><span class="pgr">' + esc(p.grade) + '</span><span class="pcnt">' + esc(p.count) + '명</span></div>' +
        '<h3>' + esc(p.condition) + '</h3>' + (p.note ? '<p>' + esc(p.note) + '</p>' : '') + '</article>';
    }).join('');
    var rows = [
      ['모집 기간', range(stage('apply'))],
      ['면접 일정', range(stage('interview'))],
      ['면접 장소', SCH.interview && SCH.interview.place ? esc(SCH.interview.place) : '미정'],
      ['면접 진행 방식', SCH.interview && SCH.interview.method ? esc(SCH.interview.method).replace(/ \/ /g, '<br>') : '미정'],
      ['급여', G.salary || '협의'],
      ['제출 자료', G.submit ? esc(G.submit.what) + '<small>(' + esc(G.submit.include) + ')</small>' : '–'],
      [G.contact ? G.contact.label : '문의', G.contact ? '<a href="mailto:' + esc(G.contact.email) + '">' + esc(G.contact.email) + '</a>' : '–']
    ].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
    var notices = (G.notices || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    return '<div class="gh"><p class="gk">' + esc(G.company || '') + ' · ' + esc(G.title || '') + '</p>' +
        '<h1 class="gt1">' + (G.tagline || []).map(esc).join('<br>') + '</h1></div>' +
      '<h2 class="gs">모집 내용</h2><div class="pos-g">' + pos + '</div>' +
      '<h2 class="gs">채용 안내</h2><div class="c"><dl class="ci">' + rows + '</dl></div>' +
      '<h2 class="gs">이 페이지 이용 안내</h2><ul class="gn">' + notices + '</ul>';
  }

  /* ---------- 라우터 ---------- */
  // 현재 화면 주소. 주소창의 #이 바뀌지 않는 환경(미리보기·샌드박스)에서도 동작하도록 변수로 따로 관리한다.
  var routeHash = location.hash || '#/';
  function parse() {
    var h = routeHash.replace(/^#\/?/, '');
    var p = h.split('/');
    return { path: p[0] || '', arg: p[1] || '' };
  }
  function go(h) {
    routeHash = h;
    try { if (location.hash !== h) history.pushState(null, '', h); } catch (e) { /* 주소 변경이 막힌 환경 */ }
    render();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  function paintNav(path) {
    nav.innerHTML = ROUTES.map(function (r) {
      return '<a href="#/' + r.path + '"' + (r.path === path ? ' aria-current="page"' : '') + '>' + r.label + '</a>';
    }).join('');
    var cur = nav.querySelector('[aria-current]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function render() {
    var r = parse();
    var known = ROUTES.some(function (x) { return x.path === r.path; });
    if (!known) { routeHash = '#/'; r = parse(); }
    paintNav(r.path);
    var html, after;
    switch (r.path) {
      case '': html = viewHome(); break;
      case 'list': html = viewList(); after = bindList; break;
      case 'personal': pc = PCTX.personal; html = viewPersonal(r.arg); after = function () { bindPersonal(r.arg); }; break;
      case 'interview': pc = PCTX.interview; html = viewPersonal(r.arg); after = function () { bindPersonal(r.arg); }; break;
      case 'applicant': html = viewApplicant(r.arg); after = bindApplicant; break;
      case 'schedule': html = viewSchedule(); break;
      case 'guide': html = viewGuide(); break;
    }
    app.innerHTML = html;
    if (after) after();
    document.title = (r.path ? ROUTES.filter(function (x) { return x.path === r.path; })[0].label + ' · ' : '') + '오픈니스 스튜디오 채용';
    window.scrollTo(0, 0);
  }
  // 뒤로 가기·주소 직접 입력
  function fromLocation() { routeHash = location.hash || '#/'; render(); }
  window.addEventListener('hashchange', fromLocation);
  window.addEventListener('popstate', fromLocation);
  render();
})();
