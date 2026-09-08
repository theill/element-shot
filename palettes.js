// Shared by the background worker (importScripts) and the settings page (script tag).
// Mesh backgrounds: a base colour with large soft colour blobs, plus the shadow tint that suits them.
const ELEMENT_SHOT = {
  DEFAULTS: { background: "pastel", color: "#e9e4dc", padding: 72, format: "png" },
  MESHES: {
    pastel: { label: "Pastel", base: "#f3ece2", blobs: ["#f7c9a8", "#f2b7c6", "#c9c6ec", "#b9dcef", "#f6e3a1"], shadow: "rgba(0,0,0,0.38)" },
    sunset: { label: "Sunset", base: "#fbe4d8", blobs: ["#ff9a76", "#ffb347", "#ff6b9d", "#ffd166", "#f4a261"], shadow: "rgba(60,20,0,0.4)" },
    ocean:  { label: "Ocean",  base: "#e3f0f5", blobs: ["#7fd3f0", "#5eead4", "#93c5fd", "#a7f3d0", "#67e8f9"], shadow: "rgba(0,30,50,0.38)" },
    night:  { label: "Night",  base: "#1b1b2f", blobs: ["#4c3f91", "#1f4068", "#5c2a9d", "#2b6777", "#7b3f61"], shadow: "rgba(0,0,0,0.65)" },
  },

  // Paint a handful of large radial blobs at low resolution, then upscale with smoothing so they melt together.
  drawMesh(ctx, W, H, { base, blobs }, seed, makeCanvas) {
    const rnd = ELEMENT_SHOT.mulberry32(seed);
    const S = 48;
    const small = makeCanvas(S, Math.max(8, Math.round((S * H) / W)));
    const sc = small.getContext("2d");
    sc.fillStyle = base;
    sc.fillRect(0, 0, small.width, small.height);
    for (const color of blobs.slice().sort(() => rnd() - 0.5)) {
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
  },

  // Monochrome noise at low alpha so a mesh reads like paper rather than a flat gradient.
  drawGrain(ctx, pw, ph, makeCanvas) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const id = ctx.createImageData(pw, ph);
    const d = id.data;
    const rnd = ELEMENT_SHOT.mulberry32(7);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = 128 + (rnd() - 0.5) * 255;
      d[i + 3] = 255;
    }
    const n = makeCanvas(pw, ph);
    n.getContext("2d").putImageData(id, 0, 0);
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = "overlay";
    ctx.drawImage(n, 0, 0);
    ctx.restore();
  },

  mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
};
