const { DEFAULTS, MESHES } = ELEMENT_SHOT;
const $ = (id) => document.getElementById(id);
const frame = $("frame"), card = frame.querySelector(".card");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const makeCanvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

let state = { ...DEFAULTS };
let savedTimer, guideTimer, sizeTimer, sizeRun = 0;
const seeds = { pastel: 11, sunset: 23, ocean: 37, night: 53 };

// ---------- preview ----------

// Backgrounds are stacked layers: a new one fades in over the old, which is then removed.
function showBackground() {
  const mesh = MESHES[state.background];
  let layer;
  if (mesh) {
    layer = document.createElement("div");
    layer.className = "layer";
    const c = makeCanvas(640, 420);
    const ctx = c.getContext("2d");
    ELEMENT_SHOT.drawMesh(ctx, c.width, c.height, mesh, seeds[state.background], makeCanvas);
    ELEMENT_SHOT.drawGrain(ctx, c.width, c.height, makeCanvas);
    layer.append(c);
  } else if (state.background === "solid") {
    layer = document.createElement("div");
    layer.className = "layer";
    layer.style.background = state.color;
  } else {
    layer = document.createElement("div");
    layer.className = "layer checker";
  }
  const old = [...frame.querySelectorAll(".layer")];
  frame.prepend(layer);
  requestAnimationFrame(() => {
    layer.classList.add("in");
    setTimeout(() => old.forEach((l) => l.remove()), reduced ? 0 : 500);
  });
  card.style.boxShadow = mesh ? `0 20px 44px -10px ${mesh.shadow}` : "0 20px 44px -10px rgba(0,0,0,0.38)";
}

// The preview frame is a fixed shape; padding maps to how far the card sits from its edge.
function showPadding(measure) {
  const pct = Math.min(38, (state.padding / 200) * 34 + 4); // 4% at 0 px, 38% at 200 px
  frame.style.setProperty("--inset", pct + "%");
  $("guideValue").textContent = `${state.padding} px`;
  $("paddingValue").textContent = `${state.padding} px`;
  $("padding").style.setProperty("--fill", (state.padding / 200) * 100 + "%");
  if (measure) {
    frame.classList.add("measuring");
    clearTimeout(guideTimer);
    guideTimer = setTimeout(() => frame.classList.remove("measuring"), 900);
  }
}

function showFormat() {
  $("seg").classList.toggle("webp", state.format === "webp");
  $("filename").textContent = `element-example.com-${stamp()}.${state.format}`;
}

// Real numbers: compose a sample at 2× the way the extension does and encode it both ways.
function estimateSizes() {
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(async () => {
    const run = ++sizeRun;
    const dpr = 2, pad = state.padding, w = 320, h = 150;
    const W = w + pad * 2, H = h + pad * 2;
    const c = makeCanvas(W * dpr, H * dpr);
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const mesh = MESHES[state.background];
    if (mesh) {
      ELEMENT_SHOT.drawMesh(ctx, W, H, mesh, seeds[state.background], makeCanvas);
      ELEMENT_SHOT.drawGrain(ctx, c.width, c.height, makeCanvas);
    } else if (state.background === "solid") {
      ctx.fillStyle = state.color;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.shadowColor = mesh?.shadow || "rgba(0,0,0,0.38)"; ctx.shadowBlur = 44; ctx.shadowOffsetY = 20;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(pad, pad, w, h, 12); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#0f172a"; ctx.font = "800 40px system-ui, sans-serif"; ctx.fillText("981,833", pad + 26, pad + 62);
    ctx.fillStyle = "#64748b"; ctx.font = "18px system-ui, sans-serif"; ctx.fillText("Total uploads", pad + 26, pad + 92);
    ctx.font = "14px system-ui, sans-serif"; ctx.fillText("608,655 active, 46,234 this week", pad + 26, pad + 122);
    const blob = (type, quality) => new Promise((r) => c.toBlob(r, type, quality));
    const [png, webp] = await Promise.all([blob("image/png"), blob("image/webp", 0.92)]);
    if (run !== sizeRun) return;
    $("pngSize").textContent = `about ${kb(png.size)}`;
    $("webpSize").textContent = `about ${kb(webp.size)}`;
    $("sizes").innerHTML = `<b>${kb(state.format === "webp" ? webp.size : png.size)}</b> at ${W * dpr}×${H * dpr}`;
  }, 180);
}

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ---------- controls ----------

function renderControls() {
  document.querySelector(`input[name=background][value="${state.background}"]`).checked = true;
  document.querySelector(`input[name=format][value="${state.format}"]`).checked = true;
  $("chipName").textContent = MESHES[state.background]?.label || (state.background === "solid" ? "Solid colour" : "Transparent");
  $("colourRow").classList.toggle("hidden", state.background !== "solid");
  $("color").value = state.color;
  $("colorValue").textContent = state.color;
  $("solidChip").style.setProperty("--solid", state.color);
  $("padding").value = state.padding;
}

function read() {
  return {
    background: document.querySelector("input[name=background]:checked").value,
    format: document.querySelector("input[name=format]:checked").value,
    color: $("color").value,
    padding: Number($("padding").value),
  };
}

async function onChange(e) {
  const prev = state;
  state = read();
  renderControls();
  if (state.background !== prev.background || state.color !== prev.color) showBackground();
  if (state.padding !== prev.padding) showPadding(true);
  if (state.format !== prev.format) showFormat();
  estimateSizes();
  await chrome.storage.sync.set(state);
  const saved = $("saved");
  saved.classList.remove("show");
  void saved.offsetWidth; // restart the check animation
  saved.classList.add("show");
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => saved.classList.remove("show"), 1400);
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  state = { ...DEFAULTS, ...stored };
  renderControls();
  showBackground();
  showPadding(false);
  showFormat();
  estimateSizes();
  setTimeout(() => frame.classList.add("ready"), reduced ? 0 : 80);
});
document.querySelectorAll("input").forEach((i) => i.addEventListener("input", onChange));
