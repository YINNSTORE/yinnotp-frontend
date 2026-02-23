export const API_BASE = process.env.API_BASE;

export async function proxyJson(req, path, init = {}) {
  if (!API_BASE) {
    return Response.json(
      { success: false, message: "API_BASE env belum diset" },
      { status: 500 }
    );
  }

  // forward auth
  const auth = req.headers.get("authorization") || "";

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: "no-store",
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  // normalize to {success:...}
  if (json && typeof json === "object" && json.success === undefined) {
    if (json.ok !== undefined) json.success = !!json.ok;
  }

  return Response.json(json || { success: false, message: "Bad JSON" }, { status: res.status });
}
