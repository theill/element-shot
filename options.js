const DEFAULTS = { background: "pastel", color: "#e9e4dc", padding: 72, format: "png" };
const $ = (id) => document.getElementById(id);
let statusTimer;

function render(s) {
  document.querySelector(`input[name=background][value="${s.background}"]`).checked = true;
  document.querySelector(`input[name=format][value="${s.format}"]`).checked = true;
  $("color").value = s.color;
  $("colorValue").textContent = s.color;
  $("solidSwatch").style.setProperty("--solid", s.color);
  $("padding").value = s.padding;
  $("paddingValue").textContent = s.padding;
  $("colorRow").style.display = s.background === "solid" ? "" : "none";
}

function read() {
  return {
    background: document.querySelector("input[name=background]:checked").value,
    format: document.querySelector("input[name=format]:checked").value,
    color: $("color").value,
    padding: Number($("padding").value),
  };
}

async function save() {
  const s = read();
  render(s);
  await chrome.storage.sync.set(s);
  $("status").classList.add("show");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => $("status").classList.remove("show"), 1200);
}

chrome.storage.sync.get(DEFAULTS, (stored) => render({ ...DEFAULTS, ...stored }));
document.querySelectorAll("input").forEach((i) => i.addEventListener("input", save));
