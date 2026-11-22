/* Pure formatting helpers. No DOM. */
(function (LockIn) {
  'use strict';

  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** "2026-11-19" -> local Date at midnight (avoids the UTC shift of new Date(iso)). */
  function parseDay(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** "Mon 16" */
  function dayColumn(iso) {
    const d = parseDay(iso);
    return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
  }

  /** "Sun, Nov 22" */
  function longDay(iso) {
    const d = parseDay(iso);
    return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }

  /** ISO timestamp -> "8:31 am" in the viewer's time zone. */
  function clockTime(isoStamp) {
    const d = new Date(isoStamp);
    if (Number.isNaN(d.getTime())) return '';
    return hhmm(d.getHours(), d.getMinutes());
  }

  function hhmm(h, m) {
    const suffix = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  /** "01:10" -> "1:10 am" */
  function onsetTime(text) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
    if (!match) return '';
    return hhmm(Number(match[1]), Number(match[2]));
  }

  /** 3.5 -> "3.5", 3 -> "3", 2.25 -> "2.3" */
  function num(n) {
    const rounded = Math.round(Number(n) * 10) / 10;
    return Number.isFinite(rounded) ? String(rounded) : '0';
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  LockIn.fmt = { parseDay, dayColumn, longDay, clockTime, onsetTime, num, clamp, plural };
})(window.LockIn = window.LockIn || {});
