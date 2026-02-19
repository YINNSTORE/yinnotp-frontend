function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function apiGet(path) {
  const r = await fetch(path, { cache: "no-store" });
  const t = await r.text();
  const j = safeJson(t);
  return { ok: r.ok, status: r.status, json: j, raw: t };
}

export async function ping() {
  return apiGet("/api/ping");
}

export async function roServices() {
  return apiGet("/api/rumahotp/services");
}

export async function roCountries(service_id) {
  return apiGet(`/api/rumahotp/countries?service_id=${encodeURIComponent(service_id)}`);
}

export async function roOperators(country, provider_id) {
  return apiGet(
    `/api/rumahotp/operators?country=${encodeURIComponent(country)}&provider_id=${encodeURIComponent(provider_id)}`
  );
}

export async function roOrder(number_id, provider_id, operator_id) {
  return apiGet(
    `/api/rumahotp/orders?number_id=${encodeURIComponent(number_id)}&provider_id=${encodeURIComponent(provider_id)}&operator_id=${encodeURIComponent(operator_id)}`
  );
}

export async function roStatusGet(order_id) {
  return apiGet(`/api/rumahotp/status/get?order_id=${encodeURIComponent(order_id)}`);
}

export async function roStatusSet(order_id, status) {
  return apiGet(
    `/api/rumahotp/status/set?order_id=${encodeURIComponent(order_id)}&status=${encodeURIComponent(status)}`
  );
}

export async function roBalance() {
  return apiGet("/api/rumahotp/balance");
}