function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function getActiveUserId() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("yinnotp_username") ||
    localStorage.getItem("username") ||
    "default"
  );
}

function key(uid) {
  return `yinnotp_activity:${uid || "default"}`;
}

export function activityList(uid = "") {
  if (typeof window === "undefined") return [];
  const u = uid || getActiveUserId();
  const raw = localStorage.getItem(key(u)) || "[]";
  const arr = safeJson(raw);
  return Array.isArray(arr) ? arr : [];
}

export function activityAdd(item, uid = "") {
  if (typeof window === "undefined") return;
  const u = uid || getActiveUserId();
  const arr = activityList(u);
  const next = [item, ...arr].slice(0, 200);
  localStorage.setItem(key(u), JSON.stringify(next));
}

export function activityClear(uid = "") {
  if (typeof window === "undefined") return;
  const u = uid || getActiveUserId();
  localStorage.setItem(key(u), "[]");
}