export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "")

export async function POST(req) {
  try {
    if (!API_BASE) {
      return new Response(
        JSON.stringify({ ok: false, message: "API base belum diset (NEXT_PUBLIC_API_BASE)" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await req.json().catch(() => ({}))

    const upstream = await fetch(`${API_BASE}/auth/register.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const text = await upstream.text()

    // return apa adanya (biar pesan backend kebaca)
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, message: "Server error (route /api/register)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// Optional: healthcheck cepat
export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/register" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}