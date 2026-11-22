# Life Quest UI

The dashboard was renamed from "Lock-In" to "Life Quest" on 2026-11-21. Internal names
(the `LockIn` JavaScript namespace, `lockin.*` localStorage keys, the `lock-in-dashboard`
repo and URL) were kept so saved tokens and links keep working.

A static dashboard page: plain HTML, CSS and JS, no build step, no trackers. It renders the
state JSON (contract version 1, see the main [README](../README.md#state-schema-version-1)).

```
ui/
  index.html      page skeleton (noindex)
  css/style.css   all styles, mobile first
  js/format.js    date / number formatting
  js/sprite.js    pixel character (SVG), one face per mood
  js/render.js    turns the JSON into the page
  js/app.js       loading, READ token, menu
```

## Open it

- **Live data:** open `ui/index.html` (from a host, or straight from disk). The first time, it asks
  for the **READ** token. After that it loads on its own.
- **Mock data:** add `?mock=1`, for example `http://localhost:8000/ui/?mock=1`. It loads
  `../mock/state.json`, so serve the repo root, not just `ui/`. Browsers block `fetch` of local
  files, so mock mode needs a local server:

  ```powershell
  npx serve .
  ```

  (or `python -m http.server` from the repo root) then open `/ui/?mock=1`.

The pill at the top right opens a menu: **Refresh**, **Copy setup link**, **Change token**,
**Forget token**. The page also refetches when you come back to the tab after 5 minutes.

### Setup link (no typing on a new device)

Open `<page URL>#token=<READ_TOKEN>` once on a device. The page saves the token, then removes it from
the address bar and history. The part after `#` is never sent to any server (not the host, not
Google Fonts). **Copy setup link** in the menu builds this link for the page you are on, so set up
one device by hand, copy the link, and AirDrop or note it to yourself for the others.

The link contains the token: send it only to yourself, don't bookmark it, and don't paste it in
chats. A `localhost` link only works on the same computer; for the iPhone, use the hosted URL.

## Host it

**Live at <https://cknathanlam1.github.io/lock-in-dashboard/>** (redirects to `/ui/`), served by
GitHub Pages from the public repo `cknathanlam1/lock-in-dashboard`, branch `main`. That repo holds
only this `ui/` folder, `mock/state.json`, a root redirect, `robots.txt` (disallow all) and
`.nojekyll`; the rest of this project is not published.

To redeploy after changing the UI: commit, then run `sh ui/publish.sh <path to a lock-in-dashboard clone>`
from the repo root. It copies `ui/` and `mock/state.json`, replaces `?v=dev` on the CSS and JS links with
the commit hash (GitHub Pages lets browsers cache files for 10 minutes, so this stops a new page
loading old scripts), commits and pushes. Pages rebuilds in about a minute.

Any static host works. GitHub Pages: publish the repo (or just `ui/`; mock mode then needs
`mock/state.json` copied next to it and `MOCK_URL` in `js/app.js` updated). The page has
`<meta name="robots" content="noindex">`, but a public Pages URL can still be found, which is fine
because the page holds no data and no token.

## How the token works

- The page source contains only the API URL (`API_URL` in `js/app.js`), never a token or data.
- On first open you paste the READ token. It is saved in this browser's `localStorage` under
  `lockin.readToken` and sent only as `?token=` to the Apps Script API.
- The request is a plain `GET` with no custom headers, so the browser makes no preflight. Apps
  Script answers with a 302 to `script.googleusercontent.com`, which allows any origin.
- If the API says `unauthorized`, the page drops the saved token and asks again.
- The READ token can only read. If it leaks, run `rotateTokens` in Apps Script and paste the new one.
- Anyone who can unlock the browser can read the dashboard. Use **Forget token** on shared devices.

## Editing yesterday and today

Tap a square for yesterday or today (only those two; checked against both the data and the device clock), then **Edit**: minutes for exercise, phone and laptop; hours,
minutes and "fell asleep at" for sleep (a time after noon counts as the evening before). **Mark as
missing** grays the day out; **Undo edit** removes the edit so the sensor value applies again.
Edited squares for today and yesterday show a pencil; every edited day says "Edited by hand" in the detail panel.

Saving sends `POST <API_URL>` with a `text/plain` JSON body (`source: "manual"`, see the main README),
which avoids a CORS preflight. Writes need the **INGEST** token, not the READ token: the page asks
for it on the first edit and keeps it in `localStorage` under `lockin.ingestToken`, apart from the
READ token. **Forget edit token** in the menu removes it. The INGEST token can write data, so don't
save it on a shared device, and it is never part of the setup link.

## Game feel

- **Since last visit:** a banner lists XP, skill gains, level-ups and new looks since this device
  last opened the page (`lockin.lastSeen.<live|mock>` in `localStorage`).
- **Streak at risk:** habits with a running streak and an unscored today are listed; their flame pulses.
- **Looks by level:** headband red → blue (Lv 2) → star pin (Lv 3) → purple (Lv 4) → gold (Lv 5),
  crown at Lv 7. The XP bar names the next unlock.

## Notes

- Gray cells: `missing` (solid, "No data") and `pending` (dashed, today, not final yet). They show
  no points and never break a streak.
- The sprite rocks about 7° each way from its feet (one tilt ≈ 0.9 s) and blinks every 4 s. Both
  stop under `prefers-reduced-motion`. `character.mood.key` picks the face:
  thriving (smile), okay, struggling (frown + sweat), drained (pale, tired), unknown (faded).
- Times show in the viewer's time zone.
- **Calendar XP:** when the API sends calendar scoring (`events.categories[].skill`, `events.days[].points`),
  the Events card labels each category with its skill (`+1/h → DIS`), adds a **Calendar XP** row
  (today shows `…` until the day is over), and skill tiles say how much of this week came from the
  calendar. Without those fields the card stays "Tracked only, never scored".
