import { proxyJson } from "../_base";

export async function GET(req) {
  return proxyJson(req, "/wallet/balance.php", { method: "GET" });
}
