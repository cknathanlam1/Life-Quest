/* Renders a state document (contract version 1) into the page. All text goes in via textContent. */
(function (LockIn) {
  'use strict';

  const fmt = LockIn.fmt;
  const $ = (id) => document.getElementById(id);

  const SKILL_COLORS = { STR: 'var(--str)', VIT: 'var(--vit)', FOC: 'var(--foc)', DIS: 'var(--dis)' };
  const FINAL = ['green', 'yellow', 'red'];
  const STATUS_LABEL = { green: 'Green', yellow: 'Yellow', red: 'Red', missing: 'No data', pending: 'Pending' };

  // Static, trusted icon markup.
  const ICONS = {
    exercise: '<svg viewBox="0 0 20 20"><path d="M2 10h16M5 6v8M15 6v8M3 8v4M17 8v4" stroke="#4a3226" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
    sleep: '<svg viewBox="0 0 20 20"><path d="M14.5 13.5A6.5 6.5 0 0 1 8 3.6a6.5 6.5 0 1 0 8.6 8.7 6.4 6.4 0 0 1-2.1 1.2Z" fill="none" stroke="#4a3226" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    phone: '<svg viewBox="0 0 20 20"><rect x="5.5" y="2.5" width="9" height="15" rx="2.2" fill="none" stroke="#4a3226" stroke-width="2.2"/><path d="M9 14.2h2" stroke="#4a3226" stroke-width="2" stroke-linecap="round"/></svg>',
    laptop: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="8.5" rx="1.5" fill="none" stroke="#4a3226" stroke-width="2.2"/><path d="M2 15.5h16" stroke="#4a3226" stroke-width="2.2" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 12 12"><path d="M6 1c.3 2-2.5 3-2.5 5.6A2.5 2.5 0 0 0 6 11a2.6 2.6 0 0 0 2.6-2.7C8.6 6.4 7 5.6 7.2 4 6.2 4.6 6 5.3 6 6c-.7-.6-.4-3 0-5Z" fill="#f0883e" stroke="#4a3226" stroke-width=".9" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 16 16"><path d="m3 8.5 3.2 3.2L13 4.5" fill="none" stroke="#4a3226" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pencil: '<svg viewBox="0 0 16 16"><path d="M3 13l1-3.5 7-7 2.5 2.5-7 7Z" fill="#fff8ec" stroke="#4a3226" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 16 16"><path d="m3.5 3.5 9 9m0-9-9 9" fill="none" stroke="#4a3226" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function iconEl(tag, className, iconKey) {
    const node = el(tag, className);
    node.innerHTML = ICONS[iconKey] || '';
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* ---------- Header ---------- */
  function renderHeader(state, source) {
    const synced = fmt.clockTime(state.generated_at);
    $('subtitle').textContent = `${fmt.longDay(state.today)}${synced ? ` · synced ${synced}` : ''}`;
    const pill = $('sourcePill');
    const isMock = source === 'mock';
    pill.replaceChildren(
      el('span', '', isMock ? 'Sample data' : 'Live data'),
      el('span', 'pill-long', isMock ? ' · mock JSON' : ' · options'),
    );
    pill.setAttribute('aria-label', isMock ? 'Sample data from mock JSON. Open menu' : 'Live data. Open menu');
  }

  /* ---------- Character ---------- */
  function renderCharacter(state) {
    const ch = state.character;
    const mood = ch.mood || { key: 'unknown', label: 'Unknown' };
    $('sprite').replaceChildren(LockIn.sprite.build(mood.key, LockIn.progress.lookFor(ch.level)));
    const moodEl = $('mood');
    moodEl.textContent = mood.label;
    moodEl.className = `mood ${mood.key}`;
    $('charName').textContent = ch.name;
    $('charLevel').textContent = `Lv ${ch.level}`;
    renderHp(ch);
    renderXp(ch);
    renderSkills(ch.skills || [], weekCalendarXp(state));
  }

  function renderHp(ch) {
    const hp = typeof ch.hp === 'number' ? ch.hp : null;
    const max = ch.hp_max || 100;
    $('hpValue').textContent = hp === null ? `— / ${max}` : `${hp} / ${max}`;
    const bar = $('hpBar');
    bar.setAttribute('aria-valuenow', hp === null ? 0 : hp);
    bar.setAttribute('aria-valuemax', max);
    const segs = [];
    for (let i = 0; i < 10; i += 1) {
      const fill = hp === null ? 0 : fmt.clamp((hp / max) * 10 - i, 0, 1);
      const seg = el('span', 'hp-seg');
      const inner = el('i');
      inner.style.width = `${fill * 100}%`;
      seg.appendChild(inner);
      segs.push(seg);
    }
    bar.replaceChildren(...segs);
    $('hpLine').textContent = hpLine(ch.hp_counts || {});
  }

  function hpLine(counts) {
    const g = counts.green || 0;
    const y = counts.yellow || 0;
    const r = counts.red || 0;
    const total = g + y + r;
    const base = `Last 7 days: ${g} green, ${y} yellow, ${r} red`;
    if (total === 0) return `${base}. No finished days yet.`;
    return `${base} → 100 × (${g} + ${fmt.num(y / 2)}) / ${total}`;
  }

  function renderXp(ch) {
    const span = ch.next_level_xp - ch.level_xp;
    const pct = span > 0 ? fmt.clamp((ch.xp - ch.level_xp) / span, 0, 1) * 100 : 0;
    $('xpValue').textContent = `${ch.xp} · ${ch.xp_to_next} to Lv ${ch.level + 1}`;
    $('xpFill').style.width = `${pct}%`;
    const next = LockIn.progress.nextUnlock(ch.level);
    $('unlockLine').textContent = next ? `Lv ${next.level} unlocks: ${next.name}` : 'Every look unlocked';
    const bar = $('xpBar');
    bar.setAttribute('aria-valuenow', Math.round(pct));
    bar.setAttribute('aria-valuemin', 0);
    bar.setAttribute('aria-valuemax', 100);
  }

  /** Calendar XP earned this week per skill, from events.days[].<category>.points (0 if absent). */
  function weekCalendarXp(state) {
    const events = state.events || { categories: [], days: [] };
    const totals = {};
    events.categories.forEach((cat) => {
      if (!cat.skill) return;
      const pts = (events.days || []).reduce((sum, d) => sum + (((d[cat.key] || {}).points) || 0), 0);
      totals[cat.skill] = (totals[cat.skill] || 0) + pts;
    });
    return totals;
  }

  function renderSkills(skills, calendarWeek) {
    const tiles = skills.map((s) => {
      const tile = el('div', 'skill');
      const top = el('div', 'skill-top');
      top.appendChild(el('span', 'skill-key', s.key));
      const sw = el('span', 'skill-sw');
      sw.style.background = SKILL_COLORS[s.key] || 'var(--gray)';
      top.appendChild(sw);
      tile.appendChild(top);
      tile.appendChild(el('div', 'skill-xp', s.xp));
      tile.appendChild(el('div', 'skill-sub', `${s.label} · +${s.week_xp} this week`));
      const fromCalendar = (calendarWeek || {})[s.key] || 0;
      if (fromCalendar > 0) tile.appendChild(el('div', 'skill-cal', `incl. +${fromCalendar} from calendar`));
      return tile;
    });
    $('skills').replaceChildren(...tiles);
  }

  /* ---------- Shared grid pieces ---------- */
  function columnHeads(state) {
    const heads = [el('div', 'row-head corner')];
    state.dates.forEach((d) => {
      const isToday = d === state.today;
      heads.push(el('div', `col-head${isToday ? ' today' : ''}`, isToday ? 'Today' : fmt.dayColumn(d)));
    });
    return heads;
  }

  /* ---------- Quest log ---------- */
  function habitHead(habit, atRisk) {
    const head = el('div', `row-head${atRisk ? ' at-risk' : ''}`);
    head.appendChild(iconEl('span', `habit-ico ${habit.key}`, habit.key));
    const text = el('div', 'row-text');
    text.appendChild(el('div', 'habit-name', habit.label));
    const meta = el('div', 'habit-meta');
    meta.appendChild(iconEl('span', '', 'flame'));
    meta.appendChild(el('span', '', `${habit.streak}d${atRisk ? '!' : ''} · → ${habit.skill}`));
    if (atRisk) meta.title = `${habit.streak}-day streak at risk today`;
    text.appendChild(meta);
    head.appendChild(text);
    return head;
  }

  function markFor(status) {
    if (status === 'green') return iconEl('span', 'mark', 'check');
    if (status === 'red') return iconEl('span', 'mark', 'cross');
    if (status === 'yellow') return el('span', 'mark', '-');
    if (status === 'pending') return el('span', 'mark', '…');
    return el('span', 'mark', '—');
  }

  function cellLabel(habit, day) {
    const value = day.display ? `, ${day.display}` : '';
    const pts = day.scored === false ? ', before scoring started, no points'
      : FINAL.includes(day.status) ? `, +${day.points} points` : '';
    const edited = day.edited ? ', edited by hand' : '';
    // (the pencil itself is decorative; the Edit button in the detail panel is the accessible control)
    return `${habit.label}, ${fmt.longDay(day.date)}: ${STATUS_LABEL[day.status] || day.status}${value}${pts}${edited}`;
  }

  function habitCell(habit, day, onSelect, editable) {
    const status = STATUS_LABEL[day.status] ? day.status : 'missing';
    const unscored = day.scored === false; // before Config start_date: shown, but earns nothing
    const cell = el('button', `cell ${status}${unscored ? ' unscored' : ''}`);
    cell.type = 'button';
    cell.dataset.habit = habit.key;
    cell.dataset.date = day.date;
    cell.setAttribute('aria-label', cellLabel(habit, day));
    cell.appendChild(markFor(status));
    if (status === 'missing') {
      cell.appendChild(el('span', '', 'No data'));
    } else {
      cell.appendChild(el('span', '', day.display || '—'));
    }
    if (FINAL.includes(status)) cell.appendChild(el('span', 'pts', unscored ? 'no XP' : `+${day.points}`));
    // Every today/yesterday square gets a pencil (tap it to open the edit form). It is filled
    // yellow when the value was already edited by hand. Older days say so only in the detail panel.
    if (editable) cell.appendChild(iconEl('span', `edit-mark${day.edited ? ' is-edited' : ''}`, 'pencil'));
    cell.addEventListener('click', (event) => {
      onSelect(habit.key, day.date, Boolean(editable && event.target.closest('.edit-mark')));
    });
    return cell;
  }

  function renderQuestGrid(state, onSelect) {
    const nodes = columnHeads(state);
    const atRisk = LockIn.progress.streaksAtRisk(state);
    state.habits.forEach((habit) => {
      nodes.push(habitHead(habit, atRisk.includes(habit)));
      const byDate = new Map(habit.days.map((d) => [d.date, d]));
      state.dates.forEach((date) => {
        const day = byDate.get(date) || { date, status: 'missing', display: '', points: 0, streak: 0, detail: {} };
        nodes.push(habitCell(habit, day, onSelect, Boolean(LockIn.edit && LockIn.edit.isEditable(state, date))));
      });
    });
    $('questGrid').replaceChildren(...nodes);
    renderRiskLine(atRisk);
  }

  function renderRiskLine(atRisk) {
    const line = $('riskLine');
    line.hidden = atRisk.length === 0;
    line.textContent = atRisk.length
      ? `Streaks on the line today: ${atRisk.map((h) => `${h.label} ${h.streak}d`).join(', ')}. Anything but red keeps them.`
      : '';
  }

  function markSelected(habitKey, date) {
    document.querySelectorAll('#questGrid .cell').forEach((c) => {
      const on = c.dataset.habit === habitKey && c.dataset.date === date;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---------- Detail panel ---------- */
  let detailAddOn = null; // optional (innerEl, habit, day, state) => void, e.g. the edit form
  function setDetailAddOn(fn) { detailAddOn = fn; }

  function detailSub(habit, day) {
    const detail = day.detail || {};
    const parts = [];
    if (habit.key === 'sleep' && detail.onset) parts.push(`Asleep ${fmt.onsetTime(detail.onset)}`);
    if (habit.key === 'exercise' && typeof detail.workouts === 'number' && day.status !== 'pending') {
      parts.push(fmt.plural(detail.workouts, 'workout'));
    }
    if (day.scored === false) parts.push('Before scoring started');
    if (day.edited) parts.push('Edited by hand');
    if (day.estimated) parts.push('Estimated: a session had no close');
    if (day.status === 'pending') parts.push('Today, not final yet');
    if (day.status === 'missing') parts.push('No data for this day');
    return parts.join(' · ');
  }

  function pointsText(habit, day) {
    const base = `${day.points} ${habit.skill}`;
    if (day.scored === false) return `${base}. Days before scoring started earn nothing`;
    if (day.status === 'red') return `${base}. Red earns nothing`;
    if (day.status === 'pending') return `${base}. Scored when the day is final`;
    if (day.status === 'missing') return `${base}. No data earns nothing`;
    return `+${base}`;
  }

  function streakText(day) {
    const days = fmt.plural(day.streak, 'day');
    if (day.status === 'red') return `${days} (reset)`;
    if (day.status === 'pending' && day.streak > 0) return `${days}, at risk today (only red resets it)`;
    if (day.status === 'missing' || day.status === 'pending') return `${days} (kept)`;
    return days;
  }

  function renderDetail(state, habitKey, date) {
    const habit = state.habits.find((h) => h.key === habitKey);
    const day = habit && habit.days.find((d) => d.date === date);
    const panel = $('detail');
    if (!habit || !day) {
      panel.replaceChildren(el('div', 'detail-inner', 'Tap a square to see details.'));
      return;
    }
    const inner = el('div', 'detail-inner');
    inner.appendChild(el('div', 'detail-date', fmt.longDay(day.date)));
    const title = el('div', 'detail-title');
    title.appendChild(el('h2', 'pixel', habit.label));
    title.appendChild(el('span', `badge ${day.status}`, STATUS_LABEL[day.status] || day.status));
    inner.appendChild(title);
    inner.appendChild(el('div', 'detail-value', day.display || '—'));
    inner.appendChild(el('div', 'detail-sub', detailSub(habit, day)));
    inner.appendChild(el('hr'));
    const dl = el('dl');
    [['Points', pointsText(habit, day), ''], ['Streak', streakText(day), ''], ['Rule', habit.rule, 'rule']]
      .forEach(([k, v, cls]) => { dl.appendChild(el('dt', '', k)); dl.appendChild(el('dd', cls, v)); });
    inner.appendChild(dl);
    if (detailAddOn) detailAddOn(inner, habit, day, state);
    panel.replaceChildren(inner);
    markSelected(habitKey, date);
  }

  /** Default selection: the newest finalized cell, first habit first. */
  function defaultSelection(state) {
    for (let i = state.dates.length - 1; i >= 0; i -= 1) {
      const date = state.dates[i];
      const habit = state.habits.find((h) => h.days.some((d) => d.date === date && FINAL.includes(d.status)));
      if (habit) return { habit: habit.key, date };
    }
    const first = state.habits[0];
    return first ? { habit: first.key, date: state.dates[state.dates.length - 1] } : null;
  }

  /* ---------- Events ---------- */
  function renderEvents(state) {
    const events = state.events || { categories: [], days: [] };
    const byDate = new Map((events.days || []).map((d) => [d.date, d]));
    const scored = events.categories.some((c) => c.skill);
    const nodes = columnHeads(state);
    events.categories.forEach((cat) => {
      const head = el('div', 'row-head');
      head.appendChild(el('span', `cat-dot ${cat.key}`));
      const text = el('div', 'row-text');
      text.appendChild(el('div', 'habit-name', cat.label));
      if (cat.skill) text.appendChild(el('div', 'habit-meta', `+${fmt.num(cat.points_per_hour || 1)}/h → ${cat.skill}`));
      head.appendChild(text);
      nodes.push(head);
      state.dates.forEach((date) => {
        const entry = (byDate.get(date) || {})[cat.key] || { hours: 0, count: 0 };
        const empty = !entry.count && !entry.hours;
        nodes.push(el('div', `ev ${empty ? 'empty' : cat.key}`, empty ? '—' : `${fmt.num(entry.hours)}h · ${entry.count}`));
      });
    });
    const busyHead = el('div', 'row-head busy-label', 'Busy total');
    nodes.push(busyHead);
    state.dates.forEach((date) => {
      const day = byDate.get(date);
      nodes.push(el('div', 'busy', day ? `${fmt.num(day.busy_hours)}h` : '—'));
    });
    if (scored) nodes.push(...pointsRow(state, byDate));
    $('eventsGrid').replaceChildren(...nodes);
    $('eventsHint').textContent = scored
      ? 'From Google Calendar. Each hour earns points for its skill once the day is over. Hours · count'
      : 'From Google Calendar. Tracked only, never scored. Hours · count';
  }

  /** "XP" row: calendar points per day; today shows … until it is over. */
  function pointsRow(state, byDate) {
    const nodes = [el('div', 'row-head busy-label', 'Calendar XP')];
    state.dates.forEach((date) => {
      const day = byDate.get(date);
      const pending = date === state.today;
      const text = pending ? '…' : `+${day && typeof day.points === 'number' ? day.points : 0}`;
      nodes.push(el('div', `busy ev-points${pending ? ' pending' : ''}`, text));
    });
    return nodes;
  }

  /* ---------- Since last visit ---------- */
  function renderReward(diff) {
    const box = $('reward');
    if (!diff) { box.hidden = true; return; }
    const parts = diff.skills.map((s) => `${s.key} +${s.delta}`);
    if (diff.levelUp && diff.xp > 0) parts.unshift(`+${diff.xp} XP`);
    if (diff.unlocked.length) parts.push(`Unlocked: ${diff.unlocked.join(', ')}`);
    $('rewardTitle').textContent = diff.levelUp ? `Level up! Lv ${diff.level}` : `+${diff.xp} XP since your last visit`;
    $('rewardText').textContent = parts.join(' · ');
    box.classList.toggle('level-up', diff.levelUp);
    box.hidden = false;
    const spriteBox = document.querySelector('.sprite-box');
    spriteBox.classList.remove('celebrate');
    void spriteBox.offsetWidth; // restart the sparkle animation
    spriteBox.classList.add('celebrate');
  }

  LockIn.render = {
    setDetailAddOn,
    el,
    reward: renderReward,
    header: renderHeader,
    character: renderCharacter,
    questGrid: renderQuestGrid,
    detail: renderDetail,
    defaultSelection,
    events: renderEvents,
    hpLine,
  };
})(window.LockIn = window.LockIn || {});
