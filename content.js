(() => {
  if (window.__elementShot) {
    window.__elementShot.start();
    return;
  }

  const Z = 2147483647;
  const MAX_NODES = 4000;
  const CAPTURE_GAP_MS = 600; // Chrome allows about two captureVisibleTab calls per second
  const SOLID_TAGS = new Set(["IMG", "CANVAS", "VIDEO", "SVG", "IFRAME", "PICTURE", "OBJECT", "EMBED",
    "INPUT", "TEXTAREA", "SELECT", "BUTTON", "PROGRESS", "METER", "HR"]);

  // ---------- picker UI, kept in a shadow root so page CSS cannot restyle it ----------

  const CSS = `
    :host { all: initial; display: block; position: fixed; inset: 0; z-index: ${Z}; pointer-events: none;
            font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
    .overlay { position: absolute; box-sizing: border-box; border: 2px solid #6366f1; background: rgba(99,102,241,.12);
               border-radius: 3px; transition: all 60ms ease-out; display: none; }
    .label { position: absolute; padding: 3px 7px; font: 12px/1.4 ui-monospace, Menlo, monospace; background: #6366f1;
             border-radius: 4px; white-space: nowrap; display: none; }
    .hint { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 8px 14px;
            background: rgba(17,17,17,.9); border-radius: 999px; box-shadow: 0 4px 16px rgba(0,0,0,.3); white-space: nowrap; }
    .hint b { font-weight: 600; }
    .toast { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 10px 16px;
             background: rgba(17,17,17,.92); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.3); white-space: nowrap; }
    .toast.error { background: #dc2626; }
  `;

  let picking = false;
  let host, root, overlay, label, hint, hovered;
  let keyboardNav = false, lastMouse = { x: 0, y: 0 }, childStack = [];

  function ensureHost() {
    if (host?.isConnected) return;
    host = document.createElement("element-shot-ui");
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
    document.documentElement.append(host);
  }

  // Drop the host element again once nothing is shown, so the page is left exactly as it was.
  function idle() {
    if (!picking && root && !root.querySelector(".toast")) {
      host.remove();
      host = root = null;
    }
  }

  function el(cls, text) {
    ensureHost();
    const n = document.createElement("div");
    n.className = cls;
    if (text) n.textContent = text;
    root.append(n);
    return n;
  }

  function mount() {
    overlay = el("overlay");
    label = el("label");
    hint = el("hint");
    hint.innerHTML = "Click to capture · <b>Shift</b> transparent PNG · <b>Alt</b> keep the whole box · <b>↑↓</b> parent / child · <b>Enter</b> capture · <b>Esc</b> cancel";
  }

  function unmount() {
    for (const n of [overlay, label, hint]) n?.remove();
    overlay = label = hint = null;
    idle();
  }

  function describe(target) {
    let s = target.tagName.toLowerCase();
    if (target.id) s += "#" + target.id;
    const cls = typeof target.className === "string" ? target.className.trim().split(/\s+/).filter(Boolean) : [];
    if (cls.length) s += "." + cls.slice(0, 2).join(".");
    const r = target.getBoundingClientRect();
    return `${s}  ${Math.round(r.width)}×${Math.round(r.height)}`;
  }

  function highlight(target) {
    hovered = target;
    const r = target.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
    });
    label.textContent = describe(target);
    label.style.display = "block";
    label.style.left = Math.max(4, r.left) + "px";
    label.style.top = (r.top > 28 ? r.top - 24 : r.bottom + 4) + "px";
  }

  // ---------- picking ----------

  function onMove(e) {
    // After arrow-key navigation, ignore small mouse jitters so the keyboard choice sticks.
    if (keyboardNav && Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) < 12) return;
    keyboardNav = false;
    lastMouse = { x: e.clientX, y: e.clientY };
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === hovered || target === document.documentElement || target === document.body) return;
    childStack = [];
    highlight(target);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault(); e.stopPropagation();
      const p = hovered?.parentElement;
      if (p && p !== document.documentElement) { childStack.push(hovered); keyboardNav = true; highlight(p); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); e.stopPropagation();
      let next = childStack.pop();
      if (!next || next.parentElement !== hovered) next = firstVisibleChild(hovered);
      if (next) { keyboardNav = true; highlight(next); }
    } else if (e.key === "Enter" && hovered) {
      e.preventDefault(); e.stopPropagation();
      pick(hovered, e);
    }
  }

  function firstVisibleChild(parent) {
    for (const c of parent?.children || []) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return c;
    }
    return null;
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const target = hovered || document.elementFromPoint(e.clientX, e.clientY);
    if (target) pick(target, e);
  }

  function pick(target, e) {
    const options = { transparent: e.shiftKey, whole: e.altKey };
    stop();
    capture(target, options).catch((err) => toast("Screenshot failed: " + (err?.message || err), true));
  }

  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };

  function start() {
    if (picking) return;
    picking = true;
    keyboardNav = false;
    childStack = [];
    mount();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousedown", swallow, true);
    document.addEventListener("mouseup", swallow, true);
    document.addEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "crosshair";
  }

  function stop() {
    if (!picking) return;
    picking = false;
    hovered = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mousedown", swallow, true);
    document.removeEventListener("mouseup", swallow, true);
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "";
    unmount();
  }

  // ---------- capture ----------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Two frames lets the page repaint; the timeout covers tabs where rAF is throttled.
  const nextFrame = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 150);
    });

  const settle = async () => { await nextFrame(); await sleep(120); };

  const send = (msg) => chrome.runtime.sendMessage(msg);

  // transparent: output PNG with alpha instead of the mesh background.
  // whole: keep the element's full box (its own background, whatever it is) instead of cutting a
  // transparent container down to the visible pieces inside it.
  async function capture(target, { transparent, whole }) {
    const origX = window.scrollX, origY = window.scrollY;
    const restore = [];
    const progress = el("toast", "Capturing…");
    try {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      await settle();
      const r = target.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const W = r.width, H = r.height;
      if (W < 1 || H < 1) throw new Error("element has no size");

      // Bigger than the window: scroll through it and stitch tiles, unless it lives in an inner scroller
      // we cannot drive, in which case the visible part is captured.
      const needX = W > vw + 0.5, needY = H > vh + 0.5;
      const tiled = (needX || needY) && !hasInnerScroller(target);
      const crop = tiled
        ? { x: r.left, y: r.top, width: W, height: H }
        : clampToViewport(r, vw, vh);
      if (crop.width < 1 || crop.height < 1) throw new Error("element is not visible in the viewport");

      const boxes = collectBoxes(target, crop, whole);

      // Sticky headers and fixed overlays that would cover the element are hidden while capturing.
      restore.push(...hideOverlays(target, tiled));
      if (tiled && needY) restore.push(...unstick(target));

      await send({ type: "element-shot:begin", viewport: { width: vw, height: vh } });
      let tiles = 0;
      const shot = async (sx, sy, sw, sh, dx, dy) => {
        if (tiles) await sleep(CAPTURE_GAP_MS);
        host.style.visibility = "hidden";
        await settle();
        try {
          const res = await send({ type: "element-shot:tile", sx, sy, sw, sh, dx, dy });
          if (!res?.ok) throw new Error(res?.error || "capture failed");
        } finally {
          host.style.visibility = "";
        }
        tiles++;
        progress.textContent = `Capturing… ${tiles}`;
      };

      const size = { w: crop.width, h: crop.height };
      if (!tiled) {
        await shot(crop.x, crop.y, crop.width, crop.height, 0, 0);
      } else {
        const docLeft = r.left + window.scrollX, docTop = r.top + window.scrollY;
        let cy = 0, coveredW = 0;
        while (cy < H - 0.5) {
          let cx = 0, rowDy = cy, rowH = 0;
          while (cx < W - 0.5) {
            window.scrollTo({
              left: needX ? docLeft + cx : window.scrollX,
              top: needY ? docTop + cy : window.scrollY,
              behavior: "instant",
            });
            await settle();
            const rr = target.getBoundingClientRect();
            const x0 = Math.max(0, rr.left), x1 = Math.min(vw, rr.right);
            const y0 = Math.max(0, rr.top), y1 = Math.min(vh, rr.bottom);
            const dx = x0 - rr.left, dy = y0 - rr.top, tw = x1 - x0, th = y1 - y0;
            if (tw < 1 || th < 1 || dx + tw <= cx + 0.5) break; // the page would not scroll further
            await shot(x0, y0, tw, th, dx, dy);
            cx = dx + tw;
            rowDy = dy;
            rowH = th;
          }
          if (rowH === 0 || rowDy + rowH <= cy + 0.5) break;
          coveredW = Math.max(coveredW, cx);
          cy = rowDy + rowH;
        }
        size.w = coveredW || crop.width;
        size.h = cy || crop.height;
      }

      const res = await send({ type: "element-shot:finish", size, boxes, transparent });
      if (!res?.ok) throw new Error(res?.error || "capture failed");

      const copied = await copyPng(res.png);
      const what = `${Math.round(size.w)}×${Math.round(size.h)}${transparent ? " transparent" : ""}${whole ? " whole-box" : ""} PNG`;
      toast(copied ? `Saved and copied ${what}` : `Saved ${what} (clipboard unavailable)`);
    } finally {
      for (const fn of restore.reverse()) fn();
      window.scrollTo({ left: origX, top: origY, behavior: "instant" });
      progress.remove();
      idle();
    }
  }

  function clampToViewport(r, vw, vh) {
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    return { x, y, width: Math.min(vw, r.right) - x, height: Math.min(vh, r.bottom) - y };
  }

  // True when an ancestor (other than the document itself) is the thing that scrolls.
  function hasInnerScroller(target) {
    for (let p = target.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return true;
    }
    return false;
  }

  // Hide fixed and sticky elements that are neither the target nor related to it. With `all`, every
  // such element is hidden (the target will scroll past all of them); otherwise only those overlapping it now.
  function hideOverlays(target, all) {
    const undo = [];
    const tr = target.getBoundingClientRect();
    for (const node of document.querySelectorAll("*")) {
      if (node === target || node === host || target.contains(node) || node.contains(target)) continue;
      const pos = getComputedStyle(node).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      if (!all) {
        const nr = node.getBoundingClientRect();
        if (!(nr.right > tr.left && nr.left < tr.right && nr.bottom > tr.top && nr.top < tr.bottom)) continue;
      }
      undo.push(override(node, "visibility", "hidden"));
    }
    return undo;
  }

  // Sticky descendants would repeat in every tile of a tall capture; pin them into normal flow meanwhile.
  function unstick(target) {
    const undo = [];
    for (const node of [target, ...target.querySelectorAll("*")]) {
      if (getComputedStyle(node).position === "sticky") undo.push(override(node, "position", "static"));
    }
    return undo;
  }

  function override(node, prop, value) {
    const prev = node.style.getPropertyValue(prop), prio = node.style.getPropertyPriority(prop);
    node.style.setProperty(prop, value, "important");
    return () => { prev ? node.style.setProperty(prop, prev, prio) : node.style.removeProperty(prop); };
  }

  // Put the PNG on the clipboard as well. Fails quietly when the page has lost focus.
  async function copyPng(dataUrl) {
    try {
      const bin = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch (err) {
      console.warn("Element Shot: clipboard write failed", err);
      return false;
    }
  }

  // ---------- shapes ----------

  // Returns boxes relative to the crop rect: {x, y, w, h, radii, solid}. Solid boxes get a drop shadow;
  // text boxes only contribute to the clip. With `whole`, the element's own box is the only shape.
  function collectBoxes(root, crop, whole) {
    const boxes = [];
    let count = 0;

    const push = (r, radii, solid) => {
      let x0 = r.left - crop.x, y0 = r.top - crop.y, x1 = r.right - crop.x, y1 = r.bottom - crop.y;
      const cut = { left: x0 < 0, top: y0 < 0, right: x1 > crop.width, bottom: y1 > crop.height };
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(crop.width, x1); y1 = Math.min(crop.height, y1);
      const w = x1 - x0, h = y1 - y0;
      if (w < 0.5 || h < 0.5) return;
      const rad = radii.map((v, i) => {
        const cutCorner = [cut.top || cut.left, cut.top || cut.right, cut.bottom || cut.right, cut.bottom || cut.left][i];
        return cutCorner ? 0 : Math.min(v, w / 2, h / 2);
      });
      boxes.push({ x: x0, y: y0, w, h, radii: rad, solid });
    };

    const pushElement = (node, s, solid) => {
      const r = node.getBoundingClientRect();
      const radii = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
        .map((v) => parseRadius(v, r.width, r.height));
      push(r, radii, solid);
    };

    const walk = (node) => {
      if (++count > MAX_NODES) throw new Error("too many nodes");
      const s = getComputedStyle(node);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return;
      if (isSolid(node, s)) { pushElement(node, s, true); return; }
      const children = node.shadowRoot ? [...node.shadowRoot.childNodes, ...node.childNodes] : node.childNodes;
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) walk(child);
        else if (child.nodeType === Node.TEXT_NODE && child.data.trim()) {
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const r of range.getClientRects()) push(r, [0, 0, 0, 0], false);
        }
      }
    };

    const rootStyle = getComputedStyle(root);
    if (!whole && !isSolid(root, rootStyle)) {
      try { walk(root); } catch { boxes.length = 0; }
    }
    if (!boxes.length) pushElement(root, rootStyle, true);
    return boxes;
  }

  // Does this element paint its own box (background, border, shadow, or replaced content)?
  function isSolid(node, s) {
    if (SOLID_TAGS.has(node.tagName.toUpperCase())) return true;
    if (alpha(s.backgroundColor) > 0 || s.backgroundImage !== "none" || s.boxShadow !== "none") return true;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== "none" && alpha(s[`border${side}Color`]) > 0) return true;
    }
    for (const pseudo of ["::before", "::after"]) {
      const p = getComputedStyle(node, pseudo);
      if (p.content === "none" || p.content === "normal" || p.display === "none") continue;
      if (alpha(p.backgroundColor) > 0 || p.backgroundImage !== "none") return true;
    }
    return false;
  }

  // Alpha of a computed colour: "rgba(0, 0, 0, 0)", "rgb(1, 2, 3)", "color(srgb 0 0 0 / 0.5)", "transparent".
  function alpha(color) {
    if (!color || color === "transparent") return 0;
    const slash = color.match(/\/\s*([\d.]+%?)\s*\)/);
    if (slash) return slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const m = color.match(/^rgba?\(([^)]+)\)/);
    if (m) { const parts = m[1].split(","); return parts.length === 4 ? parseFloat(parts[3]) : 1; }
    return 1;
  }

  // "12px", "50%", or "12px 20px" (elliptical; use the first value). Percentages are relative to the box.
  function parseRadius(value, w, h) {
    const first = String(value || "0").trim().split(/\s+/)[0];
    const n = parseFloat(first);
    if (!n || n < 0) return 0;
    const px = first.endsWith("%") ? (n / 100) * Math.min(w, h) : n;
    return Math.min(px, w / 2, h / 2);
  }

  // ---------- toasts ----------

  function toast(text, isError) {
    const t = el("toast" + (isError ? " error" : ""), text);
    setTimeout(() => { t.remove(); idle(); }, 3500);
    return t;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "element-shot:start") start();
  });

  window.__elementShot = { start, stop };
  start();
})();
