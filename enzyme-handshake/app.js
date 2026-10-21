/* The Enzyme's Handshake: the page. For now (step 2 of the build plan) a look round the room:
 * the buttons under the room move the camera between its views. The view is kept in localStorage
 * under 'handshake-lab:v1', so a reload comes back to it.
 */
(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var STORE_KEY = 'handshake-lab:v1';
  var unity = null, configured = false;
  var state = { view: 'wet' };
  try { var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); if (saved && saved.view) state.view = saved.view; } catch (e) { /* not kept */ }

  function $(id) { return document.getElementById(id); }
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ } }
  function calm() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function send(method, value) { if (unity) unity.SendMessage('Lab', method, value); }

  function configureRoom() {
    send('Configure', JSON.stringify({ calm: calm(), intro: params.get('intro') !== '0' && !sessionStorageSeen(), view: state.view,
      bench: window.HandPart2 && window.HandPart2.active ? window.HandPart2.roomView() : window.HandPart1 ? window.HandPart1.roomView() : null }));
  }
  // the opening look round the room plays once per visit
  function sessionStorageSeen() {
    try { var seen = window.sessionStorage.getItem(STORE_KEY + ':intro'); window.sessionStorage.setItem(STORE_KEY + ':intro', '1'); return !!seen; } catch (e) { return false; }
  }

  function showViews() {
    document.querySelectorAll('.view-button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === state.view ? 'true' : 'false'); });
  }

  function onUnityEvent(json) {
    var e;
    try { e = JSON.parse(json); } catch (err) { return; }
    switch (e.type) {
      case 'ready': configureRoom(); break;
      case 'configured': configured = true; $('stage-cover').hidden = true; if (window.HandPart2 && window.HandPart2.active) window.HandPart2.onConfigured(); break;
      case 'part2': case 'gc': if (window.HandPart2 && window.HandPart2.active) window.HandPart2.onUnity(e); break;
      case 'view': state.view = e.view; save(); showViews(); break;
      case 'click': if (window.HandPart2 && window.HandPart2.active) { if (window.HandPart2.click) window.HandPart2.click(e.item); } else if (window.HandPart1) window.HandPart1.click(e.item); break;
      case 'hover': if (window.HandPart2 && window.HandPart2.active) { if (window.HandPart2.hover) window.HandPart2.hover(e.item); } else if (window.HandPart1) window.HandPart1.hover(e.item); break;
    }
  }

  document.querySelectorAll('.view-button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.getAttribute('data-view'); save(); showViews();
      send('SetView', state.view);
    });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.addEventListener) mq.addEventListener('change', function () { send('SetCalm', calm() ? '1' : '0'); });
  }
  showViews();

  window.HandLab = {
    onUnityEvent: onUnityEvent,
    isMock: params.has('mock'),
    attachUnity: function (instance) { unity = instance; },
    unityProgress: function (p) { $('progress-fill').style.width = Math.round(p * 100) + '%'; },
    unityBanner: function (message, type) { if (type === 'error') $('stage-note').textContent = message; },
    unityFailed: function (error) { $('stage-status').textContent = 'The room did not load (' + error + ').'; },
    state: function () { return state; },
    show: function (view) { if (configured) send('Show', JSON.stringify(view)); },
    call: function (method, value) { if (configured) send(method, value); },
    hint: function (text) { $('stage-note').textContent = text; },
    configured: function () { return configured; }
  };
  if (window.HandLab.isMock) $('stage-status').textContent = 'The 3D room is not loaded on this page.';
})();
