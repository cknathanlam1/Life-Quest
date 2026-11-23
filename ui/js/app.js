/* Loads the state (live API or mock), handles the READ token, and wires up the page. */
(function (LockIn) {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbzm4NyKGCWMC3f2RxUy-4dHwwPFCbBWzmFgZyQyhdus3zln5wpDfTE2HdRkezG-43Hihw/exec';
  const MOCK_URL = '../mock/state.json';
  const STALE_MS = 5 * 60 * 1000; // refetch when the tab comes back after this long
  const SUPPORTED_VERSION = 1;

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const source = params.has('mock') ? 'mock' : 'live';

  let current = null; // last rendered state
  let selection = null; // { habit, date }
  let loadedAt = 0;
  let loading = false;

  /* ---------- READ token ---------- */
  const store = LockIn.store;
  const readToken = () => store.get(store.KEYS.readToken);
  const saveToken = (token) => store.set(store.KEYS.readToken, token);
  const forgetToken = () => store.remove(store.KEYS.readToken);

  /* ---------- Status line ---------- */
  function showStatus(text, isError) {
    const node = $('status');
    $('statusText').textContent = text;
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
    R.character(state);
    R.questGrid(state, select);
    R.events(state);
    const stillValid = selection && state.habits.some((h) => h.key === selection.habit) && state.dates.includes(selection.date);
    if (!stillValid) selection = R.defaultSelection(state);
    if (selection) R.detail(state, selection.habit, selection.date);
    $('app').hidden = false;
    scrollGridsToToday();
    showSinceLastVisit(state.character);
  }

  /** Banner for XP and levels gained since the last visit on this device. */
  function showSinceLastVisit(ch) {
    const key = store.KEYS.lastSeen(source);
    const diff = LockIn.progress.sinceLastVisit(store.getJSON(key), ch);
    if (diff) LockIn.render.reward(diff); // never hide a banner on a quiet refresh
    store.setJSON(key, LockIn.progress.snapshot(ch));
  }

  /** Show a cell in the detail panel; openEdit (from a pencil tap) also opens the edit form. */
  function select(habit, date, openEdit) {
    selection = { habit, date };
    LockIn.render.detail(current, habit, date);
    if (openEdit) {
      const editBtn = document.querySelector('#detail .edit-bar .btn');
      if (editBtn) editBtn.click();
    }
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

  /* ---------- Token dialog (READ token, or INGEST token for edits) ---------- */
  const TOKEN_TEXT = {
    read: {
      title: 'Read token',
      text: "Paste the dashboard's READ token. It is saved only in this browser (localStorage) and sent only to the Life Quest API.",
      placeholder: 'READ token',
    },
    ingest: {
      title: 'Edit token',
      text: 'Editing needs the INGEST token (not the READ token). It is saved only in this browser, separately, and sent only with your edits. Forget it from the menu.',
      placeholder: 'INGEST token',
    },
  };
  let tokenKind = 'read';
  let onIngestReady = null; // the save waiting for the INGEST token

  function openTokenDialog(kind, errorText) {
    tokenKind = kind;
    const copy = TOKEN_TEXT[kind];
    $('tokenTitle').textContent = copy.title;
    $('tokenText').textContent = copy.text;
    $('tokenInput').placeholder = copy.placeholder;
    $('tokenInput').value = '';
    const err = $('tokenError');
    err.textContent = errorText || '';
    err.hidden = !errorText;
    $('tokenCancel').hidden = kind === 'read' && !readToken() && !current;
    const dialog = $('tokenDialog');
    if (!dialog.open) dialog.showModal();
  }

  function askToken(errorText) {
    openTokenDialog('read', errorText);
    if (!current) {
      showStatus('Waiting for the READ token.');
      $('subtitle').textContent = 'Not connected';
    }
  }

  function askIngestToken(onReady, errorText) {
    onIngestReady = onReady;
    openTokenDialog('ingest', errorText);
  }

  function wireTokenDialog() {
    const dialog = $('tokenDialog');
    $('tokenForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const token = $('tokenInput').value.trim();
      if (!token) return;
      const key = tokenKind === 'ingest' ? store.KEYS.ingestToken : store.KEYS.readToken;
      if (!store.set(key, token)) {
        $('tokenError').textContent = 'This browser blocked saving the token (private mode?).';
        $('tokenError').hidden = false;
        return;
      }
      dialog.close();
      if (tokenKind === 'read') { load(); return; }
      const pending = onIngestReady;
      onIngestReady = null;
      if (pending) pending();
    });
    $('tokenCancel').addEventListener('click', () => { onIngestReady = null; dialog.close(); });
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
      if (action === 'copy-setup-link') copySetupLink(false);
      if (action === 'copy-setup-link-edit') copySetupLink(true);
      if (action === 'forget-edit-token') {
        store.remove(store.KEYS.ingestToken);
        showStatus('Edit token forgotten. The next edit will ask for it again.');
      }
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
    if (!fragment.has('token') && !fragment.has('ingest')) return;
    const token = (fragment.get('token') || '').trim();
    const ingest = (fragment.get('ingest') || '').trim();
    fragment.delete('token');
    fragment.delete('ingest');
    const rest = fragment.toString();
    const cleanUrl = window.location.pathname + window.location.search + (rest ? `#${rest}` : '');
    try {
      window.history.replaceState(null, '', cleanUrl);
    } catch (e) {
      window.location.hash = rest; // file:// pages may refuse replaceState
    }
    const ok = (!token || saveToken(token)) && (!ingest || store.set(store.KEYS.ingestToken, ingest));
    if (!ok) showStatus('This browser blocked saving the token (private mode?).', true);
  }

  /** withEdit adds the INGEST token so the other device can edit without typing it either. */
  function setupLink(withEdit) {
    const base = window.location.href.split('#')[0].split('?')[0];
    const ingest = withEdit ? store.get(store.KEYS.ingestToken) : '';
    return `${base}#token=${encodeURIComponent(readToken())}${ingest ? `&ingest=${encodeURIComponent(ingest)}` : ''}`;
  }

  async function copySetupLink(withEdit) {
    if (!readToken()) { askToken('Save a token first, then copy the setup link.'); return; }
    if (withEdit && !store.get(store.KEYS.ingestToken)) {
      askIngestToken(() => copySetupLink(true), 'Save the edit token here first, then copy the link again.');
      return;
    }
    const link = setupLink(withEdit);
    const what = withEdit ? 'both tokens (it can change your data)' : 'the read token';
    try {
      await navigator.clipboard.writeText(link);
      showStatus(`Setup link copied. Open it once on another device. It contains ${what}, so send it only to yourself.`);
    } catch (e) {
      window.prompt(`Copy this setup link. It contains ${what}; send it only to yourself:`, link);
    }
  }

  function wireRefresh() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && current && Date.now() - loadedAt > STALE_MS) load();
    });
  }

  /** Hooks for the edit module. */
  LockIn.app = {
    API_URL,
    source,
    askIngestToken,
    showStatus,
    reload: () => load(), // resolves when the refetch is rendered
  };

  function start() {
    LockIn.render.setDetailAddOn(LockIn.edit.attach);
    $('rewardClose').addEventListener('click', () => { $('reward').hidden = true; });
    $('statusClose').addEventListener('click', () => showStatus(''));
    wireTokenDialog();
    wireMenu();
    wireRefresh();
    consumeSetupLink();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.LockIn = window.LockIn || {});
