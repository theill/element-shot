// Element Shot background worker: starts the picker, grabs the tab, composes, downloads.

const PADDING = 72;
// Background: cream base with large soft colour blobs and a light film grain.
const MESH_BASE = "#f3ece2";
const MESH_BLOBS = ["#f7c9a8", "#f2b7c6", "#c9c6ec", "#b9dcef", "#f6e3a1"];

// Show the About page once, right after installation.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:|^file:/.test(tab.url || "")) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "element-shot:start" });
  } catch (err) {
    console.error("Element Shot: could not start picker", err);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "element-shot:shoot") return;
  shoot(msg, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // async response
});

async function shoot({ rect, boxes, viewport }, sender) {
  const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
  const capture = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const dpr = capture.width / viewport.width; // actual capture scale relative to CSS pixels

  const png = await compose(capture, rect, boxes?.length ? boxes : [{ x: 0, y: 0, w: rect.width, h: rect.height, radii: [0, 0, 0, 0], solid: true }], dpr);
  const filename = `element-${stamp()}.png`;
  await chrome.downloads.download({ url: png, filename, saveAs: false });
  return { filename };
}

// ---------- compositing ----------

async function compose(capture, rect, boxes, dpr) {
  const w = rect.width, h = rect.height;
  const W = w + PADDING * 2, H = h + PADDING * 2;
  const canvas = new OffscreenCanvas(Math.round(W * dpr), Math.round(H * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  drawMesh(ctx, W, H);
  drawGrain(ctx, canvas.width, canvas.height);

  // The crop is clipped to the visible boxes the picker found (the element itself, or the cards,
  // images and text inside a transparent container), so the background shows through everywhere else.
  // Only solid boxes (backgrounds, borders, images) cast a shadow; text lines just shape the clip.
  const shape = (filter) => {
    ctx.beginPath();
    for (const b of boxes) if (!filter || filter(b)) ctx.roundRect(PADDING + b.x, PADDING + b.y, b.w, b.h, b.radii);
  };

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#fff";
  shape((b) => b.solid);
  ctx.fill();
  ctx.restore();

  ctx.save();
  shape();
  ctx.clip();
  ctx.drawImage(capture, rect.x * dpr, rect.y * dpr, w * dpr, h * dpr, PADDING, PADDING, w, h);
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

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
