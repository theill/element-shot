# Element Shot

A tiny Chrome extension: click the toolbar icon, hover over the page, click an element, and a PNG of just that element, on a soft pastel mesh background with a drop shadow, is downloaded.

## Install

Chrome Web Store: coming soon. Until then, load it unpacked:

### Unpacked

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder.
4. Pin the "Element Shot" icon from the puzzle-piece menu if you like.

## Use

1. Click the Element Shot icon on any http(s) page.
2. Move the mouse; the element under the cursor is outlined with its tag, id, classes, and size.
3. Click to capture. Press **Esc** to cancel.
4. The PNG lands in your Downloads folder as `element-YYYYMMDD-HHMMSS.png`.

## Shapes

- If the element paints its own background or border, the crop follows its corner radius, so rounded cards get transparent corners.
- If the element is a transparent container (a flex row of cards, a grid), the crop is clipped to the visible boxes inside it: backgrounds, borders, images, form controls, and text lines. The background shows through the gaps and every solid box gets its own drop shadow.
- Text sitting directly in a transparent container keeps a strip of the page background behind each line, since the tab capture has no alpha channel to key it out.

## Notes

- The extension only touches a page when you click its icon (`activeTab` + `scripting`); `downloads` saves the PNG. No network access.
- The capture is taken from the visible tab, so an element taller than the viewport is cropped to what is on screen. It scrolls the element into view first.
- Chrome does not allow captures on `chrome://` pages or the Web Store.
- Tweak `PADDING` and the `MESH_BASE` / `MESH_BLOBS` colours at the top of `background.js` to change the look. The blob layout is randomised per shot.

## Release

- `./pack.sh` builds `dist/element-shot-<version>.zip` with only the runtime files.
- `store/LISTING.md` holds the store copy, permission justifications, and the publishing checklist.
- `PRIVACY.md` is the privacy policy; `LICENSE` is MIT.

## About

Made by [Peter Theill](https://theill.com) (peter@theill.com). Free and open source under the MIT license. The About page inside the extension (right-click the icon → Options) repeats this.
