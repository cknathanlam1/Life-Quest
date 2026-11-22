/* Pixel-art character as an SVG built from a 16 x 14 grid. The face changes with mood. */
(function (LockIn) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W = 16;

  // Body without a face. O outline, S skin, W shine, H headband.
  const BODY = [
    '.....OOOOOO.....',
    '...OOSSSSSSOO...',
    '..OSWWSSSSSSSO..',
    '.OSWSSSSSSSSSSO.',
    '.OHHHHHHHHHHHHO.',
    'OHHHHHHHHHHHHHHO',
    'OSSSSSSSSSSSSSSO',
    'OSSSSSSSSSSSSSSO',
    'OSSSSSSSSSSSSSSO',
    'OSSSSSSSSSSSSSSO',
    'OSSSSSSSSSSSSSSO',
    '.OSSSSSSSSSSSSO.',
    '.OOSSSSSSSSSSOO.',
    '..OOOOO..OOOOO..',
  ];

  // Face parts: [col, row, colorKey]
  const EYES_OPEN = [[4, 7, 'W'], [5, 7, 'K'], [4, 8, 'K'], [5, 8, 'K'], [10, 7, 'W'], [11, 7, 'K'], [10, 8, 'K'], [11, 8, 'K']];
  const EYES_CLOSED = [[4, 8, 'K'], [5, 8, 'K'], [10, 8, 'K'], [11, 8, 'K']];
  const EYES_HAPPY = [[4, 7, 'K'], [5, 7, 'K'], [3, 8, 'K'], [6, 8, 'K'], [10, 7, 'K'], [11, 7, 'K'], [9, 8, 'K'], [12, 8, 'K']];
  const EYES_TIRED = [[4, 7, 'K'], [5, 7, 'K'], [4, 8, 'K'], [5, 8, 'L'], [10, 7, 'K'], [11, 7, 'K'], [10, 8, 'L'], [11, 8, 'K']];
  const BLUSH = [[2, 9, 'B'], [3, 9, 'B'], [12, 9, 'B'], [13, 9, 'B']];
  const MOUTH_FLAT = [[7, 10, 'K'], [8, 10, 'K']];
  const MOUTH_SMILE = [[6, 10, 'K'], [9, 10, 'K'], [7, 11, 'K'], [8, 11, 'K']];
  const MOUTH_FROWN = [[7, 10, 'K'], [8, 10, 'K'], [6, 11, 'K'], [9, 11, 'K']];
  const MOUTH_SMALL = [[7, 10, 'K']];
  const SWEAT = [[15, 2, 'D'], [14, 3, 'D'], [15, 3, 'D']];

  const BASE_COLORS = {
    O: '#4a3226', S: '#fdd5a6', W: '#ffffff', H: '#e8735f', K: '#3a241a', B: '#f4a8a0', D: '#8fc4ef', L: '#3a241a',
  };

  const MOODS = {
    thriving: { open: EYES_HAPPY, closed: EYES_CLOSED, mouth: MOUTH_SMILE, extra: BLUSH, colors: {} },
    okay: { open: EYES_OPEN, closed: EYES_CLOSED, mouth: MOUTH_FLAT, extra: BLUSH, colors: {} },
    struggling: { open: EYES_OPEN, closed: EYES_CLOSED, mouth: MOUTH_FROWN, extra: BLUSH.concat(SWEAT), colors: {} },
    drained: { open: EYES_TIRED, closed: EYES_CLOSED, mouth: MOUTH_FROWN, extra: [], colors: { S: '#ead7c2', H: '#b7a197', L: '#8f7a6c' } },
    unknown: { open: EYES_OPEN, closed: EYES_CLOSED, mouth: MOUTH_SMALL, extra: [], colors: { S: '#efe0cc', H: '#c9b6aa' } },
  };

  function rect(x, y, fill) {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', 1.02);
    r.setAttribute('height', 1.02);
    r.setAttribute('fill', fill);
    return r;
  }

  function group(className, pixels, colors) {
    const g = document.createElementNS(SVG_NS, 'g');
    if (className) g.setAttribute('class', className);
    pixels.forEach(([x, y, key]) => g.appendChild(rect(x, y, colors[key])));
    return g;
  }

  function bodyPixels() {
    const pixels = [];
    BODY.forEach((row, y) => {
      [...row].forEach((ch, x) => { if (ch !== '.') pixels.push([x, y, ch]); });
    });
    return pixels;
  }

  /** Returns an <svg> of the character for a mood key (falls back to "unknown"). */
  function build(moodKey) {
    const mood = MOODS[moodKey] || MOODS.unknown;
    const colors = Object.assign({}, BASE_COLORS, mood.colors);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${BODY.length}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Character, mood: ${moodKey || 'unknown'}`);
    svg.appendChild(group('', bodyPixels(), colors));
    svg.appendChild(group('', mood.extra.concat(mood.mouth), colors));
    svg.appendChild(group('eyes-open', mood.open, colors));
    svg.appendChild(group('eyes-closed', mood.closed, colors));
    return svg;
  }

  LockIn.sprite = { build };
})(window.LockIn = window.LockIn || {});
