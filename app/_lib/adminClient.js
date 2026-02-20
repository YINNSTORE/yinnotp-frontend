function getToken() {
  if (typeof window === "undefined") return "";
  // coba beberapa key umum biar gak ngacak sistem lama lo
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("yinnotp_token") ||
    localStorage.getItem("auth_token") ||
    ""
  );
}

function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function adminUsersList({ limit = 20, offset = 0, q = "" } = {}) {
  const url = new URL("/api/admin/users/list", window.location.origin);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (q) url.searchParams.set("q", q);

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      ...authHeader(),
    },
    cache: "no-store",
  });

  const json = await r.json().catch(() => null);
  return { ok: r.ok, json };
}

export async function adminBalanceSet(username, balance_idr) {
  const r = await fetch("/api/admin/users/balance-set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ username, balance_idr }),
    cache: "no-store",
  });

  const json = await r.json().catch(() => null);
  return { ok: r.ok, json };
}

export async function adminBanSet(username, is_banned) {
  const r = await fetch("/api/admin/users/ban-set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ username, is_banned }),
    cache: "no-store",
  });

  const json = await r.json().catch(() => null);
  return { ok: r.ok, json };
}