# Lock-In UI

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

## Notes

- Gray cells: `missing` (solid, "No data") and `pending` (dashed, today, not final yet). They show
  no points and never break a streak.
- The sprite rocks about 7° each way from its feet (one tilt ≈ 0.9 s) and blinks every 4 s. Both
  stop under `prefers-reduced-motion`. `character.mood.key` picks the face:
  thriving (smile), okay, struggling (frown + sweat), drained (pale, tired), unknown (faded).
- Times show in the viewer's time zone.
