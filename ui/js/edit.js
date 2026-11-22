/* Manual edits for yesterday and today: an Edit button and form in the detail panel.
   Writes go to the API as source "manual" with the INGEST token, which is asked for on the first
   save and kept in localStorage (separately from the READ token). */
(function (LockIn) {
  'use strict';

  const EDITABLE_DAYS = 2; // yesterday and today
  const MAX_MINUTES = 1440;

  const el = (...args) => LockIn.render.el(...args);

  function isEditable(state, date) {
    return state.dates.slice(-EDITABLE_DAYS).includes(date);
  }

  /* ---------- Request ---------- */
  class EditAuthError extends Error {}

  /** POST one manual edit. text/plain keeps it a "simple" request (no CORS preflight). */
  async function postEdit(payload) {
    const app = LockIn.app;
    const body = JSON.stringify({ ...payload, token: LockIn.store.get(LockIn.store.KEYS.ingestToken), source: 'manual' });
    const res = await fetch(app.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    let result;
    try { result = await res.json(); } catch (e) { throw new Error('The server did not send JSON'); }
    if (result && result.ok) return result;
    const error = String((result && result.error) || 'unknown error');
    if (error === 'unauthorized') throw new EditAuthError('That edit token was not accepted.');
    throw new Error(error);
  }

  /* ---------- Validation (mirrors the server rules) ---------- */
  function wholeNumber(text, lo, hi) {
    const trimmed = String(text).trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return n >= lo && n <= hi ? n : null;
  }

  /** Returns { payload } or { error } from the form fields. */
  function readForm(form, habit, date) {
    if (habit.key !== 'sleep') {
      const minutes = wholeNumber(form.elements.minutes.value, 0, MAX_MINUTES);
      if (minutes === null) return { error: `Enter minutes from 0 to ${MAX_MINUTES}.` };
      return { payload: { date, habit: habit.key, value: minutes } };
    }
    const hours = wholeNumber(form.elements.hours.value || '0', 0, 24);
    const mins = wholeNumber(form.elements.mins.value || '0', 0, 59);
    if (hours === null || mins === null) return { error: 'Enter hours (0-24) and minutes (0-59).' };
    const total = hours * 60 + mins;
    if (total > MAX_MINUTES) return { error: 'Sleep can be at most 24 h.' };
    const onset = String(form.elements.onset.value || '');
    if (!/^\d{2}:\d{2}$/.test(onset)) return { error: 'Enter the time you fell asleep.' };
    return { payload: { date, habit: habit.key, value: total, onset } };
  }

  /* ---------- Saving ---------- */
  async function save(payload, ui) {
    const app = LockIn.app;
    if (app.source === 'mock') {
      ui.message('Sample data: edits are not sent anywhere.', false);
      return;
    }
    if (!LockIn.store.get(LockIn.store.KEYS.ingestToken)) {
      app.askIngestToken(() => save(payload, ui));
      return;
    }
    ui.busy(true);
    try {
      await postEdit(payload);
      await app.reload(); // the server cleared its cache, so this shows the edit
      app.showStatus(doneText(payload)); // after the reload, which clears the status line
    } catch (err) {
      if (err instanceof EditAuthError) {
        LockIn.store.remove(LockIn.store.KEYS.ingestToken);
        app.askIngestToken(() => save(payload, ui), err.message);
      } else {
        ui.message(`Not saved: ${err.message}`, true);
      }
    } finally {
      ui.busy(false);
    }
  }

  function doneText(payload) {
    if (payload.value === 'clear') return 'Edit undone. The sensor value applies again.';
    if (payload.value === 'missing') return 'Saved: marked as missing.';
    return 'Saved.';
  }

  /* ---------- Form ---------- */
  function field(label, input) {
    const wrap = el('label', 'edit-field');
    wrap.appendChild(el('span', '', label));
    wrap.appendChild(input);
    return wrap;
  }

  function numberInput(name, value, max) {
    const input = el('input');
    Object.assign(input, { type: 'number', name, min: '0', max: String(max), step: '1', inputMode: 'numeric' });
    input.value = value === null || value === undefined ? '' : String(value);
    return input;
  }

  function fieldsFor(habit, day) {
    if (habit.key !== 'sleep') {
      const value = typeof day.value === 'number' ? Math.round(day.value) : '';
      return [field('Minutes', numberInput('minutes', value, MAX_MINUTES))];
    }
    const asleep = (day.detail && day.detail.asleep_min) || (typeof day.value === 'number' ? Math.round(day.value * 60) : null);
    const onset = el('input');
    Object.assign(onset, { type: 'time', name: 'onset' });
    onset.value = (day.detail && day.detail.onset) || '';
    const row = el('div', 'edit-row');
    row.appendChild(field('Hours', numberInput('hours', asleep === null ? '' : Math.floor(asleep / 60), 24)));
    row.appendChild(field('Minutes', numberInput('mins', asleep === null ? '' : asleep % 60, 59)));
    return [row, field('Fell asleep at', onset), el('p', 'edit-hint', 'After noon counts as the evening before.')];
  }

  function button(text, cls, type) {
    const b = el('button', cls, text);
    b.type = type || 'button';
    return b;
  }

  function buildForm(habit, day, close) {
    const form = el('form', 'edit-form');
    form.noValidate = true;
    fieldsFor(habit, day).forEach((n) => form.appendChild(n));
    const msg = el('p', 'edit-msg');
    msg.hidden = true;
    const actions = el('div', 'edit-actions');
    const saveBtn = button('Save', 'btn', 'submit');
    const missingBtn = button('Mark as missing', 'btn ghost');
    const cancelBtn = button('Cancel', 'btn ghost');
    actions.append(saveBtn, missingBtn, cancelBtn);
    form.append(msg, actions);

    const ui = {
      message(text, isError) { msg.textContent = text; msg.hidden = !text; msg.classList.toggle('error', isError); },
      busy(on) { [saveBtn, missingBtn, cancelBtn].forEach((b) => { b.disabled = on; }); saveBtn.textContent = on ? 'Saving…' : 'Save'; },
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = readForm(form, habit, day.date);
      if (result.error) { ui.message(result.error, true); return; }
      save(result.payload, ui);
    });
    missingBtn.addEventListener('click', () => save({ date: day.date, habit: habit.key, value: 'missing' }, ui));
    cancelBtn.addEventListener('click', close);
    return { form, ui };
  }

  /** Detail-panel add-on: Edit / Undo edit buttons and the form, for yesterday and today only. */
  function attach(inner, habit, day, state) {
    if (!isEditable(state, day.date)) return;
    const box = el('div', 'edit-box');
    const bar = el('div', 'edit-bar');
    const editBtn = button('Edit', 'btn');
    bar.appendChild(editBtn);
    let undoUi = { message(text, isError) { LockIn.app.showStatus(text, isError); }, busy() {} };
    if (day.edited) {
      const undoBtn = button('Undo edit', 'btn ghost');
      undoBtn.addEventListener('click', () => save({ date: day.date, habit: habit.key, value: 'clear' }, undoUi));
      bar.appendChild(undoBtn);
    }
    box.appendChild(bar);
    editBtn.addEventListener('click', () => {
      const { form } = buildForm(habit, day, () => { form.remove(); bar.hidden = false; });
      bar.hidden = true;
      box.appendChild(form);
      const first = form.querySelector('input');
      if (first) first.focus();
    });
    inner.appendChild(box);
  }

  LockIn.edit = { attach, isEditable, readForm };
})(window.LockIn = window.LockIn || {});
