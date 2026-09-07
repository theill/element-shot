(() => {
  if (window.__elementShot) {
    window.__elementShot.start();
    return;
  }

  const Z = 2147483647;

  let picking = false;
  let overlay, label, hint, hovered;

  function el(tag, style) {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    return node;
  }

  function mount() {
    overlay = el("div", {
      position: "fixed", pointerEvents: "none", zIndex: Z, boxSizing: "border-box",
      border: "2px solid #6366f1", background: "rgba(99,102,241,0.12)", borderRadius: "3px",
      transition: "all 60ms ease-out", display: "none",
    });
    label = el("div", {
      position: "fixed", pointerEvents: "none", zIndex: Z, padding: "3px 7px",
      font: "12px/1.4 ui-monospace, Menlo, monospace", color: "#fff", background: "#6366f1",
      borderRadius: "4px", whiteSpace: "nowrap", display: "none",
    });
    hint = el("div", {
      position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: Z,
      padding: "8px 14px", font: "13px/1.4 system-ui, sans-serif", color: "#fff",
      background: "rgba(17,17,17,0.9)", borderRadius: "999px", pointerEvents: "none",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    });
    hint.textContent = "Click to capture \u00b7 Shift-click for a transparent PNG \u00b7 Esc to cancel";
    document.documentElement.append(overlay, label, hint);
  }

  function unmount() {
    for (const n of [overlay, label, hint]) n?.remove();
    overlay = label = hint = null;
  }

  function describe(target) {
    let s = target.tagName.toLowerCase();
    if (target.id) s += "#" + target.id;
    const cls = typeof target.className === "string" ? target.className.trim().split(/\s+/).filter(Boolean) : [];
    if (cls.length) s += "." + cls.slice(0, 2).join(".");
    const r = target.getBoundingClientRect();
    return `${s}  ${Math.round(r.width)}\u00d7${Math.round(r.height)}`;
  }

  function highlight(target) {
    hovered = target;
    const r = target.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
    });
    label.textContent = describe(target);
    label.style.display = "block";
    const above = r.top > 28;
    label.style.left = Math.max(4, r.left) + "px";
    label.style.top = (above ? r.top - 24 : r.bottom + 4) + "px";
  }

  function onMove(e) {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === hovered || target === document.documentElement || target === document.body) return;
    highlight(target);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); }
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const target = hovered || document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    const transparent = e.shiftKey;
    stop();
    capture(target, transparent).catch((err) => toast("Screenshot failed: " + (err?.message || err), true));
  }

  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };

  function start() {
    if (picking) return;
    picking = true;
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

  // Two frames lets the page repaint without our overlay; the timeout covers tabs where rAF is throttled.
  const nextFrame = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 150);
    });

  async function capture(target, transparent) {
    // Bring the element into view, then let the page repaint without our overlay before grabbing pixels.
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    await nextFrame();
    await new Promise((r) => setTimeout(r, 120)); // scrollbars / smooth-scroll settle

    const r = target.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = {
      x: Math.max(0, r.left), y: Math.max(0, r.top),
      right: Math.min(vw, r.right), bottom: Math.min(vh, r.bottom),
    };
    rect.width = rect.right - rect.x;
    rect.height = rect.bottom - rect.y;
    if (rect.width < 1 || rect.height < 1) throw new Error("element is not visible in the viewport");

    // Shapes to keep: the element itself if it paints a background or border, otherwise the visible
    // boxes inside it (cards, images, text lines) so the background shows through the gaps.
    const boxes = collectBoxes(target, rect);

    const res = await chrome.runtime.sendMessage({
      type: "element-shot:shoot", rect, boxes, transparent, viewport: { width: vw, height: vh },
    });
    if (!res?.ok) throw new Error(res?.error || "capture failed");

    const copied = await copyPng(res.png);
    const what = `${Math.round(rect.width)}\u00d7${Math.round(rect.height)}${transparent ? " transparent" : ""} PNG`;
    toast(copied ? `Saved and copied ${what}` : `Saved ${what} (clipboard unavailable)`);
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

  const MAX_NODES = 4000;
  const SOLID_TAGS = new Set(["IMG", "CANVAS", "VIDEO", "SVG", "IFRAME", "PICTURE", "OBJECT", "EMBED",
    "INPUT", "TEXTAREA", "SELECT", "BUTTON", "PROGRESS", "METER", "HR"]);

  // Returns boxes relative to the crop rect: {x, y, w, h, radii, solid}. Solid boxes get a drop shadow;
  // text boxes only contribute to the clip.
  function collectBoxes(root, crop) {
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

    const pushElement = (el, s, solid) => {
      const r = el.getBoundingClientRect();
      const radii = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
        .map((v) => parseRadius(v, r.width, r.height));
      push(r, radii, solid);
    };

    const walk = (el) => {
      if (++count > MAX_NODES) throw new Error("too many nodes");
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return;
      if (isSolid(el, s)) { pushElement(el, s, true); return; }
      const children = el.shadowRoot ? [...el.shadowRoot.childNodes, ...el.childNodes] : el.childNodes;
      for (const node of children) {
        if (node.nodeType === Node.ELEMENT_NODE) walk(node);
        else if (node.nodeType === Node.TEXT_NODE && node.data.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) push(r, [0, 0, 0, 0], false);
        }
      }
    };

    const rootStyle = getComputedStyle(root);
    if (!isSolid(root, rootStyle)) {
      try { walk(root); } catch { boxes.length = 0; }
    }
    if (!boxes.length) pushElement(root, rootStyle, true);
    return boxes;
  }

  // Does this element paint its own box (background, border, shadow, or replaced content)?
  function isSolid(el, s) {
    if (SOLID_TAGS.has(el.tagName.toUpperCase())) return true;
    if (alpha(s.backgroundColor) > 0 || s.backgroundImage !== "none" || s.boxShadow !== "none") return true;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== "none" && alpha(s[`border${side}Color`]) > 0) return true;
    }
    for (const pseudo of ["::before", "::after"]) {
      const p = getComputedStyle(el, pseudo);
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

  function toast(text, isError) {
    const t = el("div", {
      position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: Z,
      padding: "10px 16px", font: "13px/1.4 system-ui, sans-serif", color: "#fff",
      background: isError ? "#dc2626" : "rgba(17,17,17,0.92)", borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)", pointerEvents: "none",
    });
    t.textContent = text;
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 3000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "element-shot:start") start();
  });

  window.__elementShot = { start, stop };
  start();
})();
