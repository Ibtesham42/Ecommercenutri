import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/**
 * PWA install store: user-initiated install only, browser-confirmed install
 * state, single listener registration. A minimal fake `window` (EventTarget +
 * storage + matchMedia) stands in for the browser.
 */

type Fake = EventTarget & {
  localStorage: Storage;
  matchMedia: (q: string) => { matches: boolean; addEventListener: () => void };
};

let standalone = false;
let store: Map<string, string>;
let win: Fake;
let addSpy: MockInstance<Parameters<EventTarget["addEventListener"]>, void>;

function makeWindow(): Fake {
  const t = new EventTarget() as Fake;
  store = new Map();
  t.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  t.matchMedia = () => ({ matches: standalone, addEventListener: () => {} });
  return t;
}

async function load() {
  vi.resetModules();
  return import("@/lib/pwa-install");
}

/** A fake `beforeinstallprompt` event whose user choice we control. */
function bip(outcome: "accepted" | "dismissed" | "throw") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => {
    if (outcome === "throw") throw new Error("already shown");
  });
  e.userChoice = Promise.resolve({ outcome: outcome === "throw" ? "dismissed" : outcome });
  return e;
}

beforeEach(() => {
  standalone = false;
  win = makeWindow();
  addSpy = vi.spyOn(win, "addEventListener");
  vi.stubGlobal("window", win);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capture: no automatic install UI", () => {
  it("captures beforeinstallprompt, suppresses the browser's own UI, and never prompts by itself", async () => {
    const m = await load();
    const e = bip("accepted");
    win.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true); // Chrome's mini-infobar suppressed
    expect(e.prompt).not.toHaveBeenCalled(); // nothing shown until the user clicks
    expect(m.getPwaInstallState()).toMatchObject({ canPrompt: true, installed: false });
  });

  it("registers each window listener exactly once, however often it's started/subscribed", async () => {
    const m = await load();
    m.startPwaInstallCapture();
    m.startPwaInstallCapture();
    const offs = [m.subscribePwaInstall(() => {}), m.subscribePwaInstall(() => {}), m.onAppInstalled(() => {})];
    offs.forEach((off) => off());
    const types = addSpy.mock.calls.map((c) => c[0]);
    expect(types.filter((t) => t === "beforeinstallprompt")).toHaveLength(1);
    expect(types.filter((t) => t === "appinstalled")).toHaveLength(1);
  });

  it("unsubscribed listeners are no longer called (no leaks)", async () => {
    const m = await load();
    const fn = vi.fn();
    const off = m.subscribePwaInstall(fn);
    off();
    win.dispatchEvent(bip("accepted"));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("promptInstall outcomes", () => {
  it("unavailable when the browser offered no prompt", async () => {
    const m = await load();
    expect(await m.promptInstall()).toBe("unavailable");
  });

  it("accepted → the prompt is used once; NOT reported installed until the browser confirms", async () => {
    const m = await load();
    const e = bip("accepted");
    win.dispatchEvent(e);
    expect(await m.promptInstall()).toBe("accepted");
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(m.getPwaInstallState()).toMatchObject({ canPrompt: false, installed: false });
    expect(await m.promptInstall()).toBe("unavailable"); // single-use
  });

  it("dismissed → reported as dismissed, nothing marked installed", async () => {
    const m = await load();
    win.dispatchEvent(bip("dismissed"));
    expect(await m.promptInstall()).toBe("dismissed");
    expect(m.getPwaInstallState().installed).toBe(false);
  });

  it("a failing prompt degrades to 'unavailable' (falls back to instructions), no throw", async () => {
    const m = await load();
    win.dispatchEvent(bip("throw"));
    await expect(m.promptInstall()).resolves.toBe("unavailable");
  });
});

describe("installed detection", () => {
  it("only the browser's appinstalled event marks it installed, and notifies once", async () => {
    const m = await load();
    const onInstalled = vi.fn();
    m.onAppInstalled(onInstalled);
    win.dispatchEvent(new Event("appinstalled"));
    expect(m.getPwaInstallState()).toMatchObject({ installed: true, canPrompt: false });
    expect(onInstalled).toHaveBeenCalledTimes(1);
    expect(store.get(m.K_INSTALLED)).toBe("1");
  });

  it("running as the installed app → standalone + installed", async () => {
    standalone = true;
    const m = await load();
    expect(m.getPwaInstallState()).toEqual({ canPrompt: false, installed: true, standalone: true });
  });

  it("a fresh install prompt clears a stale 'installed' flag (app was removed)", async () => {
    store.set("nutriyet-pwa-installed", "1");
    const m = await load();
    expect(m.getPwaInstallState().installed).toBe(true);
    win.dispatchEvent(bip("accepted"));
    expect(m.getPwaInstallState()).toMatchObject({ installed: false, canPrompt: true });
  });

  it("server snapshot is the neutral default (no hydration mismatch)", async () => {
    const m = await load();
    expect(m.getPwaInstallServerState()).toEqual({ canPrompt: false, installed: false, standalone: false });
  });
});

describe("installGuide (manual steps when no native prompt)", () => {
  const ua = {
    iphoneSafari:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    iphoneChrome:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
    ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
    firefoxWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  };

  it("picks the right instructions per platform", async () => {
    const { installGuide } = await load();
    expect(installGuide(ua.iphoneSafari).kind).toBe("ios");
    expect(installGuide(ua.iphoneSafari).steps.join(" ")).toMatch(/Share.*Add to Home Screen/);
    expect(installGuide(ua.iphoneChrome).steps.join(" ")).toMatch(/Safari/); // non-Safari iOS hint
    expect(installGuide(ua.ipad, 5).kind).toBe("ios"); // iPadOS reports a Mac UA + touch
    expect(installGuide(ua.android).steps.join(" ")).toMatch(/Install app.*Add to Home screen/);
    expect(installGuide(ua.chromeWin).kind).toBe("desktop-chromium");
    expect(installGuide(ua.edgeWin).kind).toBe("desktop-chromium");
    expect(installGuide(ua.firefoxWin).kind).toBe("desktop-firefox");
    expect(installGuide(ua.macSafari, 0).kind).toBe("desktop-safari");
    expect(installGuide("SomeBrowser/1.0").kind).toBe("other");
  });
});
