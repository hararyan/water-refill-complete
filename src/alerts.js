// Alert sounds, notifications and saved settings for the refill staff screen.

const KEY = "wr_alert";
export const DEFAULT_SETTINGS = { mode: "beep", message: "Water refill needed", repeat: true };

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

/* ---- Custom sound file, kept on the device (IndexedDB) ---- */
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("wr", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("sounds");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveSound(file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sounds", "readwrite");
    tx.objectStore("sounds").put({ blob: file, name: file.name }, "custom");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function loadSound() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction("sounds").objectStore("sounds").get("custom");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
export async function removeSound() {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction("sounds", "readwrite");
      tx.objectStore("sounds").delete("custom");
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {}
  setCustomSound(null);
}

/* ---- Audio ---- */
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let ctx = null;
let el = null;
let customUrl = null;
let primed = false;

export function setCustomSound(blob) {
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = blob ? URL.createObjectURL(blob) : null;
}

// Browsers only allow sound after the person has tapped the page once.
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
  try {
    if (!el) el = new Audio();
    if (!primed) {
      el.src = SILENT;
      el.play()
        .then(() => {
          el.pause();
          primed = true;
        })
        .catch(() => {});
    }
  } catch {}
  try {
    window.speechSynthesis?.getVoices();
  } catch {}
}

function tone(freq, start, dur, gain = 0.5) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function beep() {
  try {
    unlockAudio();
    tone(880, 0, 0.18);
    tone(880, 0.3, 0.18);
    tone(880, 0.6, 0.18);
  } catch {}
}

function chime() {
  try {
    unlockAudio();
    tone(659, 0, 0.7);
    tone(880, 0.25, 0.7);
    tone(1175, 0.5, 0.9);
  } catch {}
}

export function playAlert(settings, text) {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  const mode = settings.mode;
  if (mode === "chime") return chime();
  if (mode === "voice" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return;
    } catch {}
  }
  if (mode === "custom" && customUrl) {
    try {
      if (!el) el = new Audio();
      el.src = customUrl;
      el.currentTime = 0;
      el.play().catch(beep);
      return;
    } catch {}
  }
  beep();
}

/* ---- Notification (works while the page is in the background) ---- */
export async function showNotification(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opts = {
    body,
    tag: "refill",
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300],
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, opts);
  } catch {}
  try {
    new Notification(title, opts);
  } catch {}
}
