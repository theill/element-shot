# Chrome Web Store listing for Element Shot

Everything below is ready to paste into the Developer Dashboard. Items marked TODO need you.

## Store listing

**Name:** Element Shot

**Summary (132 chars max, 96 used):**
Pick any element on a page and save a clean screenshot of just that element on a soft background.

**Category:** Productivity → Tools (or Developer Tools)

**Language:** English

**Detailed description:**

Element Shot screenshots exactly one element of a web page. Click the toolbar icon, hover to outline the element you want, click it, and a PNG is saved to your Downloads folder.

The element is placed on a soft pastel background with a gentle drop shadow, so a pricing card, a chart, a button, or a table looks presentation-ready straight out of the browser. No cropping, no cleanup.

What makes it nice:
• Rounded elements keep their corners. The background shows through instead of a white slab.
• A transparent container, like a row of cards, is cut into its visible parts. Each card gets its own shadow and the gaps show the background.
• The overlay shows the tag, id, classes, and size of the element under the cursor.
• Shift-click for a transparent PNG with no background, ready for slides and docs.
• Every shot is saved to Downloads and copied to the clipboard, so you can paste it right away.
• Press Esc to cancel at any time.
• Retina-aware: the PNG is saved at your display's native resolution.

Private by design:
• Runs only when you click the icon (activeTab), never in the background.
• Makes no network requests. Nothing is uploaded, collected, or tracked.
• No accounts, no settings to configure, completely free, MIT licensed.

Made by Peter Theill. Questions or ideas: peter@theill.com

## Graphic assets

- Icon 128×128: `icons/icon128.png` (already in the package).
- Small promo tile 440×280: `store/promo-440x280.png` (generated).
- Screenshots, 1280×800 or 640×400, at least one, up to five. TODO: take real ones. Good candidates:
  1. The picker overlay on a live page with a card outlined and labeled.
  2. The resulting PNG of a rounded card on the mesh background.
  3. A row of three cards captured from a transparent container.
  4. A chart or table element.
- Marquee 1400×560: optional, skip.

## Privacy practices tab

- **Single purpose:** Save a screenshot of one selected page element as a PNG.
- **Permission justifications:**
  - `activeTab`: Grants access to the current tab only after the user clicks the extension icon, so the element picker can run and the visible tab can be captured.
  - `scripting`: Injects the element picker (content.js) into the current tab when the icon is clicked. There are no static content scripts.
  - `downloads`: Saves the finished PNG to the user's Downloads folder.
  - `clipboardWrite`: Copies the same PNG to the clipboard after a capture so it can be pasted immediately.
- **Host permissions:** none.
- **Remote code:** No, the extension does not use remote code.
- **Data usage:** check none of the data types. Certify all three disclosures (no sale, no unrelated use, no creditworthiness use).
- **Privacy policy URL:** TODO. Publish `PRIVACY.md` at a public URL (the About page links to https://theill.com/element-shot/privacy; either host it there or change the link in `about.html`). A GitHub-hosted copy also works.

## Distribution

- **Visibility:** Public. **Pricing:** Free (the store no longer supports paid listings anyway).
- **Regions:** all.

## Publishing checklist

1. Bump `version` in `manifest.json` if needed (currently 1.4.0).
2. Run `./pack.sh`. It writes `dist/element-shot-<version>.zip` containing only the runtime files.
3. Developer Dashboard (https://chrome.google.com/webstore/devconsole): one-time $5 registration fee if not already registered.
4. New item → upload the zip → fill in the tabs above → Submit for review. First reviews usually take a few days.
5. After approval, put the store URL in the README.
