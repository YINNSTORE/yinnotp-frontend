export const dynamic = "force-dynamic";

export function apiKey() {
  const k = process.env.RUMAHOTP_API_KEY;
  if (!k) throw new Error("RUMAHOTP_API_KEY missing");
  return k;
}

export async function rumahGet(url) {
  const r = await fetch(url, {
    headers: {
      "x-apikey": apiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await r.text();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { r, json, text };
}