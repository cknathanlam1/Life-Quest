/* Pure game-feel helpers derived from the state: streaks at risk, level looks,
   and what changed since the last visit. No DOM. */
(function (LockIn) {
  'use strict';

  // Sprite looks unlocked by level. Each tier keeps everything from the tiers below.
  const LOOKS = [
    { level: 1, name: 'red headband', band: '#e8735f' },
    { level: 2, name: 'blue headband', band: '#6d8fd6' },
    { level: 3, name: 'star pin', band: '#6d8fd6', star: true },
    { level: 4, name: 'purple headband', band: '#b58ae0', star: true },
    { level: 5, name: 'gold headband', band: '#f4cc4c', star: true },
    { level: 7, name: 'crown', band: '#f4cc4c', star: true, crown: true },
  ];

  function dayCell(habit, date) {
    return habit.days.find((d) => d.date === date);
  }

  /** Habits whose streak is running and whose today cell is not scored yet. */
  function streaksAtRisk(state) {
    return state.habits.filter((h) => {
      const today = dayCell(h, state.today);
      return h.streak > 0 && today && today.status === 'pending';
    });
  }

  function lookFor(level) {
    return LOOKS.filter((l) => l.level <= level).pop() || LOOKS[0];
  }

  function nextUnlock(level) {
    return LOOKS.find((l) => l.level > level) || null;
  }

  /** What changed since a saved snapshot ({xp, level, skills:{KEY: xp}}), or null if nothing. */
  function sinceLastVisit(prev, ch) {
    if (!prev || typeof prev.xp !== 'number') return null;
    const xp = ch.xp - prev.xp;
    const levelUp = ch.level > prev.level;
    if (xp <= 0 && !levelUp) return null;
    const skills = (ch.skills || [])
      .map((s) => ({ key: s.key, delta: s.xp - ((prev.skills || {})[s.key] || 0) }))
      .filter((s) => s.delta > 0);
    const unlocked = LOOKS.filter((l) => l.level > prev.level && l.level <= ch.level).map((l) => l.name);
    return { xp, levelUp, level: ch.level, skills, unlocked };
  }

  function snapshot(ch) {
    const skills = {};
    (ch.skills || []).forEach((s) => { skills[s.key] = s.xp; });
    return { xp: ch.xp, level: ch.level, skills };
  }

  LockIn.progress = {
    streaksAtRisk, lookFor, nextUnlock, sinceLastVisit, snapshot,
  };
})(window.LockIn = window.LockIn || {});
