import { proxyJson } from "../_base";

export async function POST(req) {
  const body = await req.text();
  return proxyJson(req, "/wallet/credit.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
