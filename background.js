// Element Shot background worker: starts the picker, captures tiles, stitches and composes, downloads.

const PADDING = 72;
// Background: cream base with large soft colour blobs and a light film grain.
const MESH_BASE = "#f3ece2";
const MESH_BLOBS = ["#f7c9a8", "#f2b7c6", "#c9c6ec", "#b9dcef", "#f6e3a1"];
const DEFAULT_TITLE = "Element Shot: pick an element to screenshot";

// Show the About page once, right after installation.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

// Toolbar click or the keyboard shortcut (the _execute_action command lands here).
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const url = tab.url || "";
  if (!/^(https?|file):/.test(url) || /^https:\/\/chromewebstore\.google\.com\//.test(url)) {
    return flash(tab.id, "Chrome does not allow screenshots on this page");
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "element-shot:start" });
  } catch (err) {
    console.warn("Element Shot: could not start picker", err);
    flash(tab.id, url.startsWith("file:")
      ? "Turn on \"Allow access to file URLs\" for Element Shot at chrome://extensions"
      : "Element Shot cannot run on this page");
  }
});

// Show a red "!" on the icon with the reason as its tooltip, then clear it.
async function flash(tabId, message) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" });
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setTitle({ tabId, title: `Element Shot: ${message}` });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
      chrome.action.setTitle({ tabId, title: DEFAULT_TITLE }).catch(() => {});
    }, 8000);
  } catch {}
}

// ---------- capture sessions ----------
// A capture is a short conversation with the content script: begin, one or more tiles (each a crop
// of the visible tab placed at an offset inside the element), then finish, which composes and saves.

const sessions = new Map(); // tabId -> { viewport, dpr, tiles: [{ bitmap, dx, dy, w, h }] }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = { "element-shot:begin": begin, "element-shot:tile": tile, "element-shot:finish": finish }[msg?.type];
  if (!handler) return;
  handler(msg, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // async response
});

async function begin({ viewport }, sender) {
  discard(sender.tab.id);
  sessions.set(sender.tab.id, { viewport, dpr: 1, tiles: [] });
  return {};
}

async function tile({ sx, sy, sw, sh, dx, dy }, sender) {
  const s = sessions.get(sender.tab.id);
  if (!s) throw new Error("no capture in progress");
  const full = await createImageBitmap(await (await fetch(await captureTab(sender.tab.windowId))).blob());
  const dpr = full.width / s.viewport.width; // actual capture scale relative to CSS pixels
  s.dpr = dpr;
  const x = Math.max(0, Math.round(sx * dpr)), y = Math.max(0, Math.round(sy * dpr));
  const w = Math.min(full.width - x, Math.round(sw * dpr)), h = Math.min(full.height - y, Math.round(sh * dpr));
  if (w < 1 || h < 1) { full.close(); throw new Error("nothing to capture"); }
  const bitmap = await createImageBitmap(full, x, y, w, h);
  full.close();
  s.tiles.push({ bitmap, dx, dy, w: sw, h: sh });
  return {};
}

async function finish({ size, boxes, transparent }, sender) {
  const s = sessions.get(sender.tab.id);
  if (!s?.tiles.length) throw new Error("nothing was captured");
  sessions.delete(sender.tab.id);
  try {
    const shapes = boxes?.length ? boxes : [{ x: 0, y: 0, w: size.w, h: size.h, radii: [0, 0, 0, 0], solid: true }];
    const png = await compose(s.tiles, s.dpr, size, shapes, { transparent: !!transparent });
    const filename = `element-${siteName(sender.tab.url)}-${stamp()}.png`;
    await chrome.downloads.download({ url: png, filename, saveAs: false });
    // The content script also puts the PNG on the clipboard; it needs the bytes for that.
    return { filename, png };
  } finally {
    for (const t of s.tiles) t.bitmap.close();
  }
}

function discard(tabId) {
  const s = sessions.get(tabId);
  if (s) for (const t of s.tiles) t.bitmap.close();
  sessions.delete(tabId);
}

// Chrome caps captureVisibleTab at about two calls per second; wait and retry when we hit that.
async function captureTab(windowId) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    } catch (err) {
      if (attempt >= 4 || !/quota/i.test(err?.message || "")) throw err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

// ---------- compositing ----------

// transparent: no padding, no background, no shadow; just the element's shape on alpha.
async function compose(tiles, dpr, size, boxes, { transparent }) {
  const pad = transparent ? 0 : PADDING;
  const w = size.w, h = size.h;
  const W = w + pad * 2, H = h + pad * 2;
  const canvas = new OffscreenCanvas(Math.round(W * dpr), Math.round(H * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  if (!transparent) {
    drawMesh(ctx, W, H);
    drawGrain(ctx, canvas.width, canvas.height);
  }

  // The crop is clipped to the visible boxes the picker found (the element itself, or the cards,
  // images and text inside a transparent container), so the background shows through everywhere else.
  // Only solid boxes (backgrounds, borders, images) cast a shadow; text lines just shape the clip.
  const shape = (filter) => {
    ctx.beginPath();
    for (const b of boxes) if (!filter || filter(b)) ctx.roundRect(pad + b.x, pad + b.y, b.w, b.h, b.radii);
  };

  if (!transparent) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = "#fff";
    shape((b) => b.solid);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  shape();
  ctx.clip();
  for (const t of tiles) ctx.drawImage(t.bitmap, pad + t.dx, pad + t.dy, t.w, t.h);
  ctx.restore();

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return `data:image/png;base64,${toBase64(await blob.arrayBuffer())}`;
}

function drawMesh(ctx, W, H) {
  const rnd = mulberry32(Date.now() & 0xffff);
  const S = 48;
  const small = new OffscreenCanvas(S, Math.max(8, Math.round((S * H) / W)));
  const sc = small.getContext("2d");
  sc.fillStyle = MESH_BASE;
  sc.fillRect(0, 0, small.width, small.height);
  for (const color of MESH_BLOBS.slice().sort(() => rnd() - 0.5)) {
    const x = rnd() * small.width, y = rnd() * small.height;
    const r = (0.45 + rnd() * 0.4) * Math.max(small.width, small.height);
    const g = sc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color + "00");
    sc.fillStyle = g;
    sc.fillRect(0, 0, small.width, small.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, W, H);
}

function drawGrain(ctx, pw, ph) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const id = ctx.createImageData(pw, ph);
  const d = id.data;
  const rnd = mulberry32(7);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = 128 + (rnd() - 0.5) * 255;
    d[i + 3] = 255;
  }
  const n = new OffscreenCanvas(pw, ph);
  n.getContext("2d").putImageData(id, 0, 0);
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(n, 0, 0);
  ctx.restore();
}

// ---------- helpers ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// "www.example.com" -> "example.com"; local files -> "local"; anything odd -> "page".
function siteName(url) {
  try {
    const u = new URL(url || "");
    if (u.protocol === "file:") return "local";
    const host = u.hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "-");
    return host || "page";
  } catch {
    return "page";
  }
}

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
