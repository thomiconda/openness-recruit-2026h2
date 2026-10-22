/* 비밀번호 게이트
 * 지원자 데이터는 암호화(AES-GCM)되어 payload.js 에 들어 있다. 비밀번호로 키를 만들어 복호화에 성공하면 화면을 연다.
 * 비밀번호는 코드 어디에도 들어 있지 않다. (틀리면 복호화가 실패한다) */
(function () {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder();
  var SS = 'opn_k';              // 같은 탭에서 새로고침해도 다시 묻지 않도록 키를 세션에만 잠시 보관
  var key = null, fails = 0;
  // 마우스가 있는 기기(PC)에서는 바로 입력할 수 있게 입력창에 초점을 준다.
  // 터치 기기(폰·태블릿)에서는 초점을 주지 않는다: 열자마자 키패드가 올라와 화면을 가리기 때문이다. 입력창을 직접 눌러 입력한다.
  var AUTOFOCUS = !!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);

  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function $(id) { return document.getElementById(id); }

  /* 잠금 화면 시계: 날짜(10월 22일 목요일)와 시각(7:42). 분이 바뀔 때만 갱신한다 */
  function tick() {
    var d = new Date(), h = d.getHours() % 12 || 12, m = d.getMinutes();
    var dt = $('lockDate'), tm = $('lockTime');
    if (dt) dt.textContent = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    if (tm) tm.textContent = h + ':' + (m < 10 ? '0' : '') + m;
    setTimeout(tick, (60 - d.getSeconds()) * 1000 - d.getMilliseconds() + 20);
  }
  tick();

  async function deriveKey(pw, salt, iter) {
    var km = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, km,
      { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  async function open(k, u8) {   // iv(12) + 암호문
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, k, u8.slice(12)));
  }

  /* 지원자별 큰 이미지 번들: 상세 페이지를 열 때 필요한 것만 내려받아 복호화한다 */
  window.SECURE_LOADER = function (no) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'b/a' + (no < 10 ? '0' : '') + no + '.js';
      s.onerror = function () { reject(new Error('이미지를 불러오지 못했습니다.')); };
      s.onload = async function () {
        try {
          var plain = await open(key, unb64(window.__B[no]));
          var hl = new DataView(plain.buffer).getUint32(0);
          var head = JSON.parse(dec.decode(plain.slice(4, 4 + hl)));
          var pos = 4 + hl, urls = [];
          head.files.forEach(function (f) {
            urls.push(URL.createObjectURL(new Blob([plain.slice(pos, pos + f.size)], { type: f.type })));
            pos += f.size;
          });
          delete window.__B[no];
          resolve(urls);
        } catch (e) { reject(e); }
      };
      document.head.appendChild(s);
    });
  };

  function boot(data) {
    window.APPLICANTS = data.applicants;
    ['schedule', 'guide'].forEach(function (k) {
      var s = document.createElement('script'); s.text = data.scripts[k]; document.head.appendChild(s);
    });
    document.body.classList.remove('locked');
    $('gate').hidden = true;
    var a = document.createElement('script');
    a.src = 'js/app.js';
    document.body.appendChild(a);
  }

  async function unlock(k) {
    var raw = unb64(window.__PAYLOAD);
    var plain = await open(k, raw.slice(24));            // 매직4 + 반복4 + salt16 뒤가 암호문
    key = k;
    window.__PAYLOAD = null;
    boot(JSON.parse(dec.decode(plain)));
  }

  async function submit(e) {
    e.preventDefault();
    var msg = $('gateMsg'), btn = $('gateBtn'), pw = $('gatePw').value;
    if (!pw) { $('gatePw').focus(); return; }      // 비어 있을 때 화살표를 누르면 입력창으로 이동
    btn.disabled = true; msg.textContent = '확인 중…';
    try {
      var raw = unb64(window.__PAYLOAD);
      var iter = new DataView(raw.buffer).getUint32(4);
      var k = await deriveKey(pw, raw.slice(8, 24), iter);
      await unlock(k);
      try { sessionStorage.setItem(SS, b64(new Uint8Array(await crypto.subtle.exportKey('raw', k)))); } catch (x) { /* 저장 불가 환경 */ }
    } catch (err) {
      if (!(err && err.name === 'OperationError')) console.error('[gate]', err);   // 비밀번호 오류가 아닌 문제는 콘솔에 남긴다
      fails++;
      $('gatePw').value = '';
      btn.disabled = true;
      msg.textContent = '비밀번호가 맞지 않습니다.' + (fails > 2 ? ' 잠시 후 다시 시도해 주세요.' : '');
      var fld = $('gateField');
      if (fld) { fld.classList.remove('shake'); void fld.offsetWidth; fld.classList.add('shake'); }
      setTimeout(function () { btn.disabled = false; if (AUTOFOCUS) $('gatePw').focus(); }, Math.min(1000 * fails, 8000));
      return;
    }
    btn.disabled = false;
  }

  async function init() {
    if (!window.crypto || !crypto.subtle) {
      $('gateMsg').textContent = '이 브라우저에서는 열 수 없습니다. 최신 Chrome·Edge·Safari를 사용해 주세요.';
      $('gateBtn').disabled = true; return;
    }
    $('gateForm').addEventListener('submit', submit);
    try {                                                 // 같은 탭에서 이미 입력했다면 바로 연다
      var saved = sessionStorage.getItem(SS);
      if (saved) {
        var k = await crypto.subtle.importKey('raw', unb64(saved), 'AES-GCM', true, ['decrypt']);
        await unlock(k); return;
      }
    } catch (e) { try { sessionStorage.removeItem(SS); } catch (x) {} }
    if (AUTOFOCUS) $('gatePw').focus();
  }
  init();
})();
