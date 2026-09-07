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

1. Click the Element Shot icon on any http(s) page, or press **Alt+Shift+S** (configurable at `chrome://extensions/shortcuts`).
2. Move the mouse; the element under the cursor is outlined with its tag, id, classes, and size. **↑** and **↓** step to the parent or first child, **Enter** captures the outlined element.
3. Click to capture. **Shift-click** for a transparent PNG with no background or padding. **Alt-click** (Option on Mac) to keep the element's whole box as it is instead of cutting a transparent container down to the visible pieces inside it. The two combine. Press **Esc** to cancel.
4. The image lands in your Downloads folder as `element-<site>-YYYYMMDD-HHMMSS.png` (or `.webp`) and a PNG copy goes to the clipboard.

## Settings

Right-click the icon and choose Options (or open the settings link on the About page):

- **Background**: Pastel (default), Sunset, Ocean, Night, a solid colour of your choice, or transparent. All keep the padding and shadow; Shift-click while picking is the tight transparent cut without either.
- **Padding** around the element, 0 to 200 px (default 72).
- **File format**: PNG or WebP. The clipboard copy is always PNG because that is what apps accept on paste.

Settings sync through Chrome when you are signed in.

## Shapes

- If the element paints its own background or border, the crop follows its corner radius, so rounded cards get transparent corners.
- If the element is a transparent container (a flex row of cards, a grid), the crop is clipped to the visible boxes inside it: backgrounds, borders, images, form controls, and text lines. The background shows through the gaps and every solid box gets its own drop shadow. Alt-click to skip this and keep the whole box, page background included.
- Text sitting directly in a transparent container keeps a strip of the page background behind each line, since the tab capture has no alpha channel to key it out.

## Notes

- The extension only touches a page when you click its icon (`activeTab` + `scripting`); `downloads` saves the file, `clipboardWrite` copies it, and `storage` keeps your settings. No network access.
- On pages Chrome will not capture (its own pages, the Web Store) the icon shows a red `!` with the reason in its tooltip. Local files need "Allow access to file URLs" enabled for the extension.
- Elements bigger than the window are captured in tiles: the page is scrolled through the element, each visible part is grabbed, and the pieces are stitched. Chrome allows about two captures per second, so a very tall element takes a few seconds; a progress toast counts the tiles. Elements inside an inner scrolling container are captured as far as they are visible.
- Fixed and sticky elements that would cover the target (navbars, cookie banners) are hidden during the capture and restored afterwards. Sticky parts inside a tall element are pinned into normal flow while it is stitched so they do not repeat.
- The picker's overlay, hint, and toasts live in a shadow root and are removed from the page when idle, so page CSS cannot restyle them and nothing is left behind.
- Chrome does not allow captures on `chrome://` pages or the Web Store.
- The mesh palettes are the `MESHES` table at the top of `background.js`; the blob layout is randomised per shot.

## Release

- `./pack.sh` builds `dist/element-shot-<version>.zip` with only the runtime files.
- `store/LISTING.md` holds the store copy, permission justifications, and the publishing checklist.
- `PRIVACY.md` is the privacy policy; `LICENSE` is MIT.

## About

Made by [Peter Theill](https://theill.com) (peter@theill.com). Free and open source under the MIT license. The About page inside the extension (right-click the icon → Options) repeats this.
