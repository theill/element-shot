# Marketing assets

Screenshots for the Chrome Web Store listing, the README, and social posts. All are 1280×800 PNG, the store's preferred size. They were produced with the real picker overlay and the real compositor on a demo dashboard, so what they show is exactly what the extension does.

| File | Shows | Suggested use |
|---|---|---|
| `screenshots/01-pick-an-element.png` | The picker on a dashboard: the outlined card, its tag/id/size label, and the hint bar with all shortcuts | Store screenshot 1 |
| `screenshots/02-polished-result.png` | A single stat card on the default Pastel background with the drop shadow | Store screenshot 2, README hero |
| `screenshots/03-groups-as-cards.png` | A transparent row of three cards cut into separate cards with the background showing between them | Store screenshot 3 |
| `screenshots/04-background-styles.png` | The same chart card on Pastel, Sunset, Ocean, and Night | Store screenshot 4 |
| `screenshots/05-transparent-png.png` | Shift-click output on a checkerboard: no background, no padding | Store screenshot 5 |
| `screenshots/06-settings.png` | The settings page | Store screenshot 6 or the README settings section |

Other assets:

- `../store/promo-440x280.png` — small promo tile for the store (with a 2× master beside it).
- `../icons/icon128.png` — the store icon. Source is `../icons/icon.svg`; `../icons/icon-small.svg` is a heavier-stroke version used for the 16 and 32 px toolbar sizes (`rsvg-convert -w N -h N -o iconN.png icon.svg`).

## Regenerating

The demo dashboard and the framing page live under `dist/shots/` while generating (gitignored). They stub the Chrome APIs, load `content.js` and `background.js` from the repo, and render at 1280×800 in Chrome DevTools. The capture of the dashboard is taken at 2× so the composited cards stay crisp.
