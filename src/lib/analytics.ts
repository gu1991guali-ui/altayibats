import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const VISITOR_ID_KEY = "tayyibat_visitor_id";
const SESSION_ID_KEY = "tayyibat_session_id";
const LAST_TRACK_KEY = "tayyibat_last_tracked_visit";
const DUPLICATE_WINDOW_MS = 30_000;

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // التخزين قد يكون معطلاً في بعض المتصفحات، لذلك نتجاهل الخطأ ونكمل دون تعطيل الموقع.
  }
}

function getStoredClientId(storage: Storage | undefined, key: string) {
  const existing = readStorage(storage, key);

  if (existing) {
    return existing;
  }

  const nextId = createClientId();
  writeStorage(storage, key, nextId);
  return nextId;
}

function isTrackablePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return true;
  }

  const hiddenPrefixes = ["/admin", "/login", "/register", "/account"];

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return true;
}

function getVideoIdFromPath(pathname: string) {
  const match = pathname.match(/^\/videos\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function shouldSkipDuplicate(pathname: string) {
  try {
    const lastValue = window.sessionStorage.getItem(LAST_TRACK_KEY);

    if (!lastValue) {
      return false;
    }

    const parsed = JSON.parse(lastValue) as { path?: string; time?: number };
    return parsed.path === pathname && typeof parsed.time === "number" && Date.now() - parsed.time < DUPLICATE_WINDOW_MS;
  } catch {
    return false;
  }
}

function rememberTrackedPath(pathname: string) {
  try {
    window.sessionStorage.setItem(LAST_TRACK_KEY, JSON.stringify({ path: pathname, time: Date.now() }));
  } catch {
    // لا شيء؛ التسجيل نفسه أهم من حفظ منع التكرار.
  }
}

export async function trackPageVisit(pathname: string) {
  if (!isSupabaseConfigured || typeof window === "undefined") {
    return;
  }

  const normalizedPath = pathname || "/";

  if (!isTrackablePath(normalizedPath) || shouldSkipDuplicate(normalizedPath)) {
    return;
  }

  rememberTrackedPath(normalizedPath);

  const visitorId = getStoredClientId(window.localStorage, VISITOR_ID_KEY);
  const sessionId = getStoredClientId(window.sessionStorage, SESSION_ID_KEY);

  const { error } = await supabase.from("site_visits").insert({
    visitor_id: visitorId,
    session_id: sessionId,
    path: normalizedPath,
    video_id: getVideoIdFromPath(normalizedPath),
    page_title: document.title || null,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent?.slice(0, 500) ?? null
  });

  if (error && import.meta.env.DEV) {
    console.warn("تعذر تسجيل زيارة الموقع. تأكد من تشغيل database/02_ADD_VISIT_ANALYTICS.sql", error.message);
  }
}
