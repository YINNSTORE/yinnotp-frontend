// _lib/adminClient.js
"use client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ||
  "https://yinnhosting.serv00.net/api";

function readToken() {
  if (typeof window === "undefined") return "";
  // prioritas token aktif
  const t1 = localStorage.getItem("yinnotp_token_active");
  if (t1) return String(t1);

  const t2 = localStorage.getItem("yinnotp_token");
  if (t2) return String(t2);

  // fallback dari last_session
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (raw) {
      const j = JSON.parse(raw);
      if (j?.token) return String(j.token);
    }
  } catch {}

  return "";
}

async function apiFetch(path, { method = "GET", query = null, body = null } = {}) {
  const token = readToken();
  const url = new URL(API_BASE + (path.startsWith("/") ? path : `/${path}`));

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      const s = String(v).trim();
      if (s === "") return;
      url.searchParams.set(k, s);
    });
  }

  const headers = {
    "Content-Type": "application/json",
  };

  // kirim dua-duanya biar aman (backend kamu support Authorization Bearer)
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Token"] = token;
  }

  let resp;
  let text = "";
  let json = null;

  try {
    resp = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    text = await resp.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { ok: resp.ok, status: resp.status, json, text, url: url.toString() };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: String(e?.message || e || "Network error"),
      url: url.toString(),
    };
  }
}

/* ================= endpoints ================= */

export function adminUsersList({ limit = 20, offset = 0, q = "" } = {}) {
  return apiFetch("/admin/users/list.php", {
    method: "GET",
    query: { limit, offset, q },
  });
}

export function adminBalanceSet(username, balanceIdr) {
  const u = String(username || "").trim();
  const n = Number(balanceIdr);

  // kirim field yang paling mungkin dipakai backend
  return apiFetch("/admin/users/balance_set.php", {
    method: "POST",
    body: {
      username: u,
      balance_idr: Math.floor(Number.isFinite(n) ? n : 0),
      balanceIdr: Math.floor(Number.isFinite(n) ? n : 0), // fallback kalau backend pake camelCase
    },
  });
}

export function adminBanSet(username, isBanned) {
  const u = String(username || "").trim();
  const b = !!isBanned;

  return apiFetch("/admin/users/ban_set.php", {
    method: "POST",
    body: {
      username: u,
      is_banned: b ? 1 : 0,
      banned: b ? 1 : 0, // fallback
    },
  });
}

export function adminSettingsGet() {
  return apiFetch("/admin/settings/get.php", { method: "GET" });
}

export function adminSettingsSet(key, value) {
  return apiFetch("/admin/settings/set.php", {
    method: "POST",
    body: { key: String(key || ""), value: String(value ?? "") },
  });
}