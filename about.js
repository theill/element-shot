document.getElementById("version").textContent = chrome.runtime.getManifest().version;
document.getElementById("year").textContent = new Date().getFullYear();
