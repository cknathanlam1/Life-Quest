/* Loads the state (live API or mock), handles the READ token, and wires up the page. */
(function (LockIn) {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbzm4NyKGCWMC3f2RxUy-4dHwwPFCbBWzmFgZyQyhdus3zln5wpDfTE2HdRkezG-43Hihw/exec';
  const MOCK_URL = '../mock/state.json';
  const TOKEN_KEY = 'lockin.readToken';
  const STALE_MS = 5 * 60 * 1000; // refetch when the tab comes back after this long
  const SUPPORTED_VERSION = 1;

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const source = params.has('mock') ? 'mock' : 'live';

  let current = null; // last rendered state
  let selection = null; // { habit, date }
  let loadedAt = 0;
  let loading = false;

  /* ---------- Token storage (localStorage can throw in private modes) ---------- */
  function readToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function saveToken(token) {
    try { window.localStorage.setItem(TOKEN_KEY, token); return true; } catch (e) { return false; }
  }
  function forgetToken() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* nothing stored */ }
  }

  /* ---------- Status line ---------- */
  function showStatus(text, isError) {
    const node = $('status');
    node.textContent = text;
    node.classList.toggle('error', Boolean(isError));
    node.hidden = !text;
  }

  /* ---------- Fetching ---------- */
  class AuthError extends Error {}

  async function fetchState(token) {
    // Plain GET, no custom headers: Apps Script answers with a 302 to a host that allows any origin.
    const url = source === 'mock' ? MOCK_URL : `${API_URL}?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    let body;
    try { body = await res.json(); } catch (e) { throw new Error('The server did not send JSON'); }
    if (body && body.ok === false) {
      if (body.error === 'unauthorized') throw new AuthError('That token was not accepted.');
      throw new Error(`API error: ${String(body.error || 'unknown')}`);
    }
    validate(body);
    return body;
  }

  function validate(state) {
    const ok = state && typeof state === 'object' && Array.isArray(state.dates) && Array.isArray(state.habits)
      && state.character && typeof state.character === 'object';
    if (!ok) throw new Error('The data is not in the expected shape');
    if (state.version !== SUPPORTED_VERSION) {
      showStatus(`Data version ${state.version} (this page expects ${SUPPORTED_VERSION}). Some parts may look wrong.`, true);
    }
  }

  async function load() {
    if (loading) return;
    const token = readToken();
    if (source === 'live' && !token) { askToken(''); return; }
    loading = true;
    if (!current) showStatus('Loading…');
    try {
      const state = await fetchState(token);
      loadedAt = Date.now();
      if (state.version === SUPPORTED_VERSION) showStatus('');
      render(state);
    } catch (err) {
      if (err instanceof AuthError) {
        forgetToken(); // don't keep retrying a rejected token
        askToken(err.message);
      } else {
        showStatus(`Could not load the dashboard: ${err.message}. Check the connection, then use Refresh.`, true);
      }
    } finally {
      loading = false;
    }
  }

  /* ---------- Rendering ---------- */
  function render(state) {
    current = state;
    const R = LockIn.render;
    R.header(state, source);
    R.character(state.character);
    R.questGrid(state, select);
    R.events(state);
    const stillValid = selection && state.habits.some((h) => h.key === selection.habit) && state.dates.includes(selection.date);
    if (!stillValid) selection = R.defaultSelection(state);
    if (selection) R.detail(state, selection.habit, selection.date);
    $('app').hidden = false;
    scrollGridsToToday();
  }

  function select(habit, date) {
    selection = { habit, date };
    LockIn.render.detail(current, habit, date);
    const panel = $('detail');
    const rect = panel.getBoundingClientRect();
    if (rect.top > window.innerHeight - 80 || rect.bottom < 0) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
    }
  }

  /** On narrow screens, start the 7-day grids scrolled to the newest days. */
  function scrollGridsToToday() {
    ['questScroll', 'eventsScroll'].forEach((id) => {
      const box = $(id);
      box.scrollLeft = box.scrollWidth;
    });
  }

  /* ---------- Token dialog ---------- */
  function askToken(errorText) {
    const dialog = $('tokenDialog');
    const err = $('tokenError');
    err.textContent = errorText || '';
    err.hidden = !errorText;
    $('tokenInput').value = '';
    $('tokenCancel').hidden = !readToken() && !current;
    if (!dialog.open) dialog.showModal();
    if (!current) {
      showStatus('Waiting for the READ token.');
      $('subtitle').textContent = 'Not connected';
    }
  }

  function wireTokenDialog() {
    const dialog = $('tokenDialog');
    $('tokenForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const token = $('tokenInput').value.trim();
      if (!token) return;
      if (!saveToken(token)) {
        $('tokenError').textContent = 'This browser blocked saving the token (private mode?).';
        $('tokenError').hidden = false;
        return;
      }
      dialog.close();
      load();
    });
    $('tokenCancel').addEventListener('click', () => dialog.close());
  }

  /* ---------- Menu ---------- */
  function setMenu(open) {
    $('menu').hidden = !open;
    $('sourcePill').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function wireMenu() {
    const pill = $('sourcePill');
    pill.textContent = source === 'mock' ? 'Sample data' : 'Live data';
    if (source === 'mock') {
      $('menu').querySelectorAll('[data-live-only]').forEach((b) => { b.hidden = true; });
    }
    pill.addEventListener('click', (event) => {
      event.stopPropagation();
      setMenu($('menu').hidden);
    });
    document.addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });
    $('menu').addEventListener('click', (event) => {
      const action = event.target.closest('button') && event.target.closest('button').dataset.action;
      setMenu(false);
      if (action === 'refresh') load();
      if (action === 'change-token') askToken('');
      if (action === 'copy-setup-link') copySetupLink();
      if (action === 'forget-token') {
        forgetToken();
        current = null;
        $('app').hidden = true;
        askToken('Token forgotten. Paste a token to load the dashboard again.');
      }
    });
  }

  /* ---------- Setup link: .../ui/#token=READ_TOKEN ----------
     The fragment (after #) is never sent to any server. Save the token, then strip it from the
     address bar and history right away so it is not left in a bookmark or shared screenshot. */
  function consumeSetupLink() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const fragment = new URLSearchParams(hash);
    if (!fragment.has('token')) return;
    const token = (fragment.get('token') || '').trim();
    fragment.delete('token');
    const rest = fragment.toString();
    const cleanUrl = window.location.pathname + window.location.search + (rest ? `#${rest}` : '');
    try {
      window.history.replaceState(null, '', cleanUrl);
    } catch (e) {
      window.location.hash = rest; // file:// pages may refuse replaceState
    }
    if (token && !saveToken(token)) showStatus('This browser blocked saving the token (private mode?).', true);
  }

  function setupLink() {
    const base = window.location.href.split('#')[0].split('?')[0];
    return `${base}#token=${encodeURIComponent(readToken())}`;
  }

  async function copySetupLink() {
    if (!readToken()) { askToken('Save a token first, then copy the setup link.'); return; }
    const link = setupLink();
    try {
      await navigator.clipboard.writeText(link);
      showStatus('Setup link copied. Open it once on another device; it contains the token, so send it only to yourself.');
    } catch (e) {
      window.prompt('Copy this setup link (it contains the token, send it only to yourself):', link);
    }
  }

  function wireRefresh() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && current && Date.now() - loadedAt > STALE_MS) load();
    });
  }

  function start() {
    wireTokenDialog();
    wireMenu();
    wireRefresh();
    consumeSetupLink();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.LockIn = window.LockIn || {});
