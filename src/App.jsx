import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, isConfigured } from "./firebase.js";
import {
  loadSettings,
  saveSettings,
  loadSound,
  saveSound,
  removeSound,
  setCustomSound,
  unlockAudio,
  playAlert,
  showNotification,
} from "./alerts.js";

const STAFF_PIN = import.meta.env.VITE_STAFF_PIN || "";
const HISTORY_COUNT = 3;

function useRequests() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "refillRequests"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError("");
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, []);

  return { requests, error, loading };
}

function timeAgo(ts) {
  if (!ts?.toMillis) return "just now";
  const mins = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return ts.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
}

/* The water can: drains and turns amber while a refill is requested. */
function Can({ waiting }) {
  const top = waiting ? 138 : 40; // y of the water surface
  const fill = waiting ? "#e8a13a" : "#38b6f0";
  const surface = waiting ? "#f3c27a" : "#7fd3f7";
  return (
    <svg className="can" viewBox="0 0 120 160" role="img" aria-label={waiting ? "Water can is empty" : "Water can is full"}>
      <defs>
        <clipPath id="canClip">
          <path d="M44 8h32a6 6 0 0 1 6 6v18c14 4 18 12 18 24v82a14 14 0 0 1-14 14H34a14 14 0 0 1-14-14V56c0-12 4-20 18-24V14a6 6 0 0 1 6-6z" />
        </clipPath>
      </defs>
      <g clipPath="url(#canClip)">
        <rect width="120" height="160" className="back" />
        <g className="water" style={{ "--y": `${top}px` }}>
          <rect y="0" width="120" height="170" fill={fill} className="surface" />
          <ellipse cx="60" cy="0" rx="46" ry="4" fill={surface} className="surface" />
        </g>
      </g>
      <path
        className="outline"
        d="M44 8h32a6 6 0 0 1 6 6v18c14 4 18 12 18 24v82a14 14 0 0 1-14 14H34a14 14 0 0 1-14-14V56c0-12 4-20 18-24V14a6 6 0 0 1 6-6z"
      />
    </svg>
  );
}

const THEMES = [
  {
    id: "light",
    label: "Light",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    ),
  },
  {
    id: "wheat",
    label: "Wheat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V9" />
        <path d="M12 9c-2.5 0-3.5-1.8-3.5-3.5C10.5 5.5 12 6.8 12 9zM12 9c2.5 0 3.5-1.8 3.5-3.5C13.5 5.5 12 6.8 12 9z" />
        <path d="M12 15c-2.5 0-3.5-1.8-3.5-3.5C10.5 11.5 12 12.8 12 15zM12 15c2.5 0 3.5-1.8 3.5-3.5C13.5 11.5 12 12.8 12 15z" />
        <path d="M12 9V2.5" />
      </svg>
    ),
  },
];

const THEME_COLORS = { light: "#0b2a3c", dark: "#0a141c", wheat: "#f0dfb8" };

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("wr_theme", theme);
    } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);
  return [theme, setTheme];
}

function ThemeSwitch({ theme, setTheme }) {
  return (
    <div className="themes" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          aria-pressed={theme === t.id}
          aria-label={`${t.label} theme`}
          title={`${t.label} theme`}
          onClick={() => setTheme(t.id)}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

/* Offers "Install app" (Android/Chrome/desktop) or a hint for iPhone. */
function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("wr_install_hidden2") === "1";
    } catch {
      return false;
    }
  });
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem("wr_install_hidden2", "1");
    } catch {}
  }

  if (standalone || hidden || (!evt && !isIOS && !waited)) return null;

  return (
    <div className="install">
      <span>
        {evt
          ? "Install this app on your device."
          : isSafari
          ? "To install: tap Share, then Add to Home Screen (on a Mac: File, then Add to Dock)."
          : "To install: open the browser menu and choose Install app or Add to Home screen."}
      </span>
      <span className="install-actions">
        {evt && (
          <button
            className="btn small"
            onClick={async () => {
              evt.prompt();
              await evt.userChoice;
              setEvt(null);
            }}
          >
            Install
          </button>
        )}
        <button className="btn quiet" onClick={hide} aria-label="Dismiss install message">
          Not now
        </button>
      </span>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#38b6f0">
          <path d="M12 2.5c3.6 4.3 6.5 7.7 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 10.2 8.4 6.8 12 2.5z" />
        </svg>
      </span>
      <span>Water Refill</span>
    </div>
  );
}

function RequestView({ requests, loading }) {
  const [location, setLocation] = useState(() => localStorage.getItem("wr_location") || "");
  const [name, setName] = useState(() => localStorage.getItem("wr_name") || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", error: false });
  useTick();

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const history = useMemo(
    () => requests.filter((r) => r.status === "done").slice(0, HISTORY_COUNT),
    [requests]
  );
  const trimmed = location.trim();
  const duplicate = pending.find((r) => r.location.toLowerCase() === trimmed.toLowerCase());
  const waiting = pending.length > 0;

  async function submit(e) {
    e.preventDefault();
    if (!trimmed || duplicate) return;
    setBusy(true);
    setMsg({ text: "", error: false });
    try {
      localStorage.setItem("wr_location", trimmed);
      localStorage.setItem("wr_name", name.trim());
      await addDoc(collection(db, "refillRequests"), {
        location: trimmed.slice(0, 60),
        requestedBy: name.trim().slice(0, 40),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setMsg({ text: "Request sent. The refill person can see it now.", error: false });
    } catch (err) {
      setMsg({ text: "Couldn't send the request: " + err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <Can waiting={waiting} />
        <div>
          <h1>
            {loading
              ? "Checking the can…"
              : waiting
              ? pending.length === 1
                ? "Refill requested"
                : `${pending.length} refills requested`
              : "Water can is full"}
          </h1>
          <p>
            {waiting
              ? `Waiting at ${pending[0].location}${pending.length > 1 ? ` and ${pending.length - 1} more` : ""}.`
              : "No one is waiting. Request a refill if a can runs out."}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Request a refill</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="loc">Where is the empty can?</label>
            <input
              id="loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="3rd floor pantry"
              maxLength={60}
              autoComplete="off"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="who">
              Your name <span className="opt">(optional)</span>
            </label>
            <input
              id="who"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aryan"
              maxLength={40}
              autoComplete="given-name"
            />
          </div>
          <button className="btn" disabled={busy || !trimmed || !!duplicate}>
            {duplicate ? "Already requested" : busy ? "Sending…" : "Request refill"}
          </button>
        </form>
        {msg.text && <p className={"msg" + (msg.error ? " error" : "")}>{msg.text}</p>}
      </section>

      {pending.length > 0 && (
        <section className="panel">
          <h2>Waiting for refill</h2>
          <ul className="rows">
            {pending.map((r) => (
              <li key={r.id}>
                <div className="row-main">
                  <div className="row-title">{r.location}</div>
                  <div className="row-sub">
                    {r.requestedBy ? `${r.requestedBy}, ` : ""}
                    {timeAgo(r.createdAt)}
                  </div>
                </div>
                <span className="pill wait">Pending</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>
          Recent refills <span className="hint">Last {HISTORY_COUNT}</span>
        </h2>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : history.length === 0 ? (
          <p className="empty">No refills yet.</p>
        ) : (
          <ul className="rows">
            {history.map((r) => (
              <li key={r.id}>
                <div className="row-main">
                  <div className="row-title">{r.location}</div>
                  <div className="row-sub">{timeAgo(r.doneAt)}</div>
                </div>
                <span className="pill ok">Done</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StaffView({ requests, loading }) {
  const [unlocked, setUnlocked] = useState(!STAFF_PIN || sessionStorage.getItem("wr_staff") === "1");
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [notifOn, setNotifOn] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const seen = useRef(null);
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [soundName, setSoundName] = useState("");
  const [awake, setAwake] = useState(false);
  const wakeLock = useRef(null);
  useTick();

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status === "done").slice(0, HISTORY_COUNT);
  const places = pending.map((r) => r.location).join(", ");

  function update(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  // Load the saved custom sound, and unlock audio on the first tap anywhere
  useEffect(() => {
    loadSound().then((rec) => {
      if (rec) {
        setCustomSound(rec.blob);
        setSoundName(rec.name);
      }
    });
    const first = () => unlockAudio();
    document.addEventListener("pointerdown", first);
    return () => document.removeEventListener("pointerdown", first);
  }, []);

  // Alert staff when a new request arrives
  useEffect(() => {
    if (!unlocked || loading) return;
    const ids = new Set(pending.map((r) => r.id));
    if (seen.current) {
      const fresh = pending.filter((r) => !seen.current.has(r.id));
      if (fresh.length) {
        const where = fresh.map((r) => r.location).join(", ");
        const s = settingsRef.current;
        playAlert(s, `${s.message}. ${where}`);
        if (document.hidden) showNotification(s.message, where);
      }
    }
    seen.current = ids;
  }, [pending.map((r) => r.id).join(","), unlocked, loading]);

  // Keep alerting every 30 seconds until every request is marked done
  useEffect(() => {
    if (!unlocked || loading || !settings.repeat || pending.length === 0) return;
    const t = setInterval(() => {
      const s = settingsRef.current;
      playAlert(s, `${s.message}. ${places}`);
      if (document.hidden) showNotification(s.message, places);
    }, 30000);
    return () => clearInterval(t);
  }, [unlocked, loading, settings.repeat, pending.length, places]);

  // Keep the screen from sleeping (so alerts keep working)
  useEffect(() => {
    if (!awake || !("wakeLock" in navigator)) return;
    const get = async () => {
      try {
        wakeLock.current = await navigator.wakeLock.request("screen");
      } catch {}
    };
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wakeLock.current?.release?.();
      wakeLock.current = null;
    };
  }, [awake]);

  async function pickSound(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("Choose a sound under 5 MB.");
    try {
      await saveSound(file);
      setCustomSound(file);
      setSoundName(file.name);
      update({ mode: "custom" });
    } catch {
      alert("Couldn't save that sound on this device.");
    }
  }

  async function clearSound() {
    await removeSound();
    setSoundName("");
    if (settings.mode === "custom") update({ mode: "beep" });
  }

  useEffect(() => {
    document.title = pending.length ? `(${pending.length}) Water Refill` : "Water Refill";
  }, [pending.length]);

  function unlock(e) {
    e.preventDefault();
    if (pin === STAFF_PIN) {
      sessionStorage.setItem("wr_staff", "1");
      setUnlocked(true);
    } else setPinErr(true);
  }

  async function enableNotif() {
    unlockAudio();
    if (typeof Notification === "undefined") return alert("This browser doesn't support notifications.");
    const p = await Notification.requestPermission();
    setNotifOn(p === "granted");
  }

  async function markDone(id) {
    try {
      await updateDoc(doc(db, "refillRequests", id), { status: "done", doneAt: serverTimestamp() });
    } catch (err) {
      alert("Couldn't mark as done: " + err.message);
    }
  }

  if (!unlocked) {
    return (
      <section className="panel pin-wrap">
        <h2>Refill staff</h2>
        <form onSubmit={unlock}>
          <div className="field">
            <label htmlFor="pin">Enter your PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinErr(false);
              }}
              autoFocus
            />
          </div>
          {pinErr && <p className="msg error" style={{ margin: 0 }}>That PIN is wrong. Try again.</p>}
          <button className="btn">Open</button>
        </form>
      </section>
    );
  }

  const waiting = pending.length > 0;

  return (
    <>
      <section className="hero">
        <Can waiting={waiting} />
        <div>
          <h1>
            {loading
              ? "Checking requests…"
              : waiting
              ? `${pending.length} to refill`
              : "All cans are full"}
          </h1>
          <p>{waiting ? "Replace the can, then tap Done." : "You'll get an alert when a new request comes in."}</p>
        </div>
      </section>

      {!notifOn && (
        <div className="banner">
          <button className="btn quiet" onClick={enableNotif}>
            Turn on alerts
          </button>
        </div>
      )}

      {waiting && (
        <section className="panel">
          <h2>To refill</h2>
          <ul className="rows">
            {pending.map((r) => (
              <li key={r.id}>
                <div className="row-main">
                  <div className="row-title">{r.location}</div>
                  <div className="row-sub">
                    {r.requestedBy ? `${r.requestedBy}, ` : ""}
                    {timeAgo(r.createdAt)}
                  </div>
                </div>
                <button className="btn done small" onClick={() => markDone(r.id)}>
                  Done
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>
          Recent refills <span className="hint">Last {HISTORY_COUNT}</span>
        </h2>
        {history.length === 0 ? (
          <p className="empty">No refills yet.</p>
        ) : (
          <ul className="rows">
            {history.map((r) => (
              <li key={r.id}>
                <div className="row-main">
                  <div className="row-title">{r.location}</div>
                  <div className="row-sub">{timeAgo(r.doneAt)}</div>
                </div>
                <span className="pill ok">Done</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Alert settings</h2>

        <fieldset className="opts">
          <legend>Alert sound</legend>
          {[
            ["beep", "Beep"],
            ["chime", "Chime"],
            ["voice", "Spoken message"],
            ["custom", soundName ? `My sound (${soundName})` : "My sound"],
          ].map(([id, label]) => (
            <label key={id} className="opt">
              <input
                type="radio"
                name="mode"
                checked={settings.mode === id}
                disabled={id === "custom" && !soundName}
                onChange={() => update({ mode: id })}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="alertmsg">Alert message</label>
          <input
            id="alertmsg"
            value={settings.message}
            maxLength={80}
            onChange={(e) => update({ message: e.target.value })}
            placeholder="Water refill needed"
          />
          <span className="row-sub">Shown in the notification and read aloud for "Spoken message".</span>
        </div>

        <div className="btn-row">
          <label className="btn quiet file-btn">
            {soundName ? "Change my sound" : "Add my sound"}
            <input type="file" accept="audio/*" onChange={pickSound} hidden />
          </label>
          {soundName && (
            <button className="btn quiet" onClick={clearSound}>
              Remove my sound
            </button>
          )}
        </div>
        <span className="row-sub">Pick an audio file from your phone, such as a ringtone or voice recording.</span>

        <label className="opt" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={settings.repeat} onChange={(e) => update({ repeat: e.target.checked })} />
          <span>Repeat every 30 seconds until marked done</span>
        </label>

        {"wakeLock" in navigator && (
          <label className="opt">
            <input type="checkbox" checked={awake} onChange={(e) => setAwake(e.target.checked)} />
            <span>Keep screen on while this page is open</span>
          </label>
        )}

        <div className="btn-row">
          <button
            className="btn small"
            onClick={() => {
              unlockAudio();
              playAlert(settings, `${settings.message}. 3rd floor pantry`);
            }}
          >
            Play test alert
          </button>
        </div>
        <p className="row-sub" style={{ marginTop: 12 }}>
          Alerts work while this page or app is open, even if you switch to another tab or app. If your phone locks or
          closes the app, they stop.
        </p>
      </section>
    </>
  );
}

export default function App() {
  const [tab, setTab] = useState(location.hash === "#staff" ? "staff" : "request");
  const { requests, error, loading } = useRequests();
  const [theme, setTheme] = useTheme();
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  useEffect(() => {
    location.hash = tab === "staff" ? "staff" : "";
  }, [tab]);

  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "request"} onClick={() => setTab("request")}>
              Request
            </button>
            <button role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")}>
              Staff
              {pendingCount > 0 && <span className="count">{pendingCount}</span>}
            </button>
          </div>
          <ThemeSwitch theme={theme} setTheme={setTheme} />
        </div>
      </header>

      <InstallPrompt />

      {!isConfigured && (
        <p className="msg error banner">
          Firebase isn't set up. Add your keys to a <code>.env</code> file and restart the app.
        </p>
      )}
      {error && <p className="msg error banner">Database error: {error}</p>}

      {tab === "request" ? (
        <RequestView requests={requests} loading={loading} />
      ) : (
        <StaffView requests={requests} loading={loading} />
      )}
    </div>
  );
}
