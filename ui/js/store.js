/* localStorage wrapper. Storage can throw (private mode, blocked site data), so every call is
   guarded and the page keeps working without it. */
(function (LockIn) {
  'use strict';

  const KEYS = {
    readToken: 'lockin.readToken',
    ingestToken: 'lockin.ingestToken',
    lastSeen: (source) => `lockin.lastSeen.${source}`,
  };

  function get(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  /** Returns true when saved. */
  function set(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function remove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* nothing stored */ }
  }

  function getJSON(key) {
    const raw = get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function setJSON(key, value) {
    return set(key, JSON.stringify(value));
  }

  LockIn.store = { KEYS, get, set, remove, getJSON, setJSON };
})(window.LockIn = window.LockIn || {});
