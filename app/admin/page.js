"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, RefreshCw, Ban, Shield, Wallet } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function getToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("yinnotp_token_active") ||
    localStorage.getItem("yinnotp_token") ||
    ""
  );
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState(null);
  const [unauth, setUnauth] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [editUser, setEditUser] = useState(null);
  const [mode, setMode] = useState("set"); // set | add | sub
  const [amount, setAmount] = useState("");

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const maxPage = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / limit)),
    [total, limit]
  );

  async function loadMe() {
    const token = getToken();
    if (!token) {
      setUnauth("Belum login (token kosong).");
      setChecking(false);
      return;
    }
    try {
      const r = await fetch("/api/auth/me", {
        method: "GET",
        headers: { ...authHeaders() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setUnauth(j?.message || "Session tidak valid.");
        setChecking(false);
        return;
      }

      setMe(j.data || null);

      const role = String(j?.data?.role || "").toLowerCase();
      if (role !== "admin") {
        setUnauth("Akses ditolak (bukan admin).");
      }
    } catch {
      setUnauth("Server error.");
    } finally {
      setChecking(false);
    }
  }

  async function loadUsers(nextOffset = offset, nextLimit = limit) {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/users/list?limit=${encodeURIComponent(
          nextLimit
        )}&offset=${encodeURIComponent(nextOffset)}`,
        { method: "GET", headers: { ...authHeaders() }, cache: "no-store" }
      );
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        toast.error(j?.message || "Gagal load users");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(j?.data?.items) ? j.data.items : []);
      setTotal(Number(j?.data?.total || 0) || 0);
    } catch {
      toast.error("Server error");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function setBan(username, is_banned) {
    if (!username) return;
    try {
      const r = await fetch("/api/admin/users/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ username, is_banned: !!is_banned }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return toast.error(j?.message || "Gagal update ban");
      toast.success("OK");
      await loadUsers(offset, limit);
    } catch {
      toast.error("Server error");
    }
  }

  async function submitBalance() {
    const username = String(editUser?.username || "").trim();
    const n = Number(amount);
    if (!username) return toast.error("Username kosong");
    if (!Number.isFinite(n)) return toast.error("Nominal tidak valid");

    try {
      const r = await fetch("/api/admin/users/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          username,
          mode, // "set" | "add" | "sub"
          amount: n,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok)
        return toast.error(j?.message || "Gagal update saldo");
      toast.success("OK");
      setEditUser(null);
      setAmount("");
      await loadUsers(offset, limit);
    } catch {
      toast.error("Server error");
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!unauth && me && String(me?.role || "").toLowerCase() === "admin") {
      loadUsers(offset, limit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unauth, me, offset, limit]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[780px] items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            style={{ boxShadow: "var(--yinn-soft)" }}
            aria-label="Kembali"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight">
              Control Panel
            </div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              Kelola user, saldo, ban
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => {
                if (!unauth && me && String(me?.role || "").toLowerCase() === "admin") {
                  loadUsers(offset, limit);
                } else {
                  loadMe();
                }
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[780px] px-4 pt-4 pb-24">
        <section
          className="rounded-2xl border p-4"
          style={{
            background: "var(--yinn-surface)",
            borderColor: "var(--yinn-border)",
            boxShadow: "var(--yinn-soft)",
          }}
        >
          {checking ? (
            <div className="text-sm font-extrabold">Cek akses admin…</div>
          ) : unauth ? (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold">Tidak bisa akses</div>
              <div className="text-xs text-[var(--yinn-muted)]">{unauth}</div>
              <Link
                href="/login"
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold"
              >
                Ke Login
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--yinn-border)] px-3 py-1 text-xs font-extrabold">
                <Shield size={14} />
                Admin: {me?.username || "—"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--yinn-border)] px-3 py-1 text-xs font-extrabold text-[var(--yinn-muted)]">
                Total user: {total}
              </div>

              <div className="ms-auto flex items-center gap-2">
                <select
                  className="rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-2 text-xs font-extrabold"
                  value={limit}
                  onChange={(e) => {
                    setOffset(0);
                    setLimit(Number(e.target.value) || 20);
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>

                <div className="text-xs font-extrabold text-[var(--yinn-muted)]">
                  Page {page}/{maxPage}
                </div>

                <button
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                  disabled={offset <= 0 || loading}
                  onClick={() => setOffset((v) => Math.max(0, v - limit))}
                >
                  Prev
                </button>
                <button
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                  disabled={offset + limit >= total || loading}
                  onClick={() => setOffset((v) => v + limit)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {!checking && !unauth ? (
          <section className="mt-4 grid gap-2">
            {loading ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                Loading users…
              </div>
            ) : items.length ? (
              items.map((u) => {
                const banned = !!u?.is_banned;
                return (
                  <div
                    key={String(u?.id || u?.username || Math.random())}
                    className="rounded-2xl border p-4"
                    style={{
                      background: "var(--yinn-surface)",
                      borderColor: "var(--yinn-border)",
                      boxShadow: "var(--yinn-soft)",
                    }}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold">
                          {u?.username || "—"}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--yinn-muted)]">
                          <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                            role: {u?.role || "user"}
                          </span>
                          <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                            saldo: {formatIDR(u?.balance_idr || 0)}
                          </span>
                          <span
                            className={cx(
                              "rounded-full border px-2 py-0.5",
                              banned
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-600"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                            )}
                          >
                            {banned ? "BANNED" : "ACTIVE"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setEditUser(u);
                            setMode("set");
                            setAmount("");
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold"
                        >
                          <Wallet size={16} />
                          Saldo
                        </button>

                        <button
                          onClick={() => setBan(u?.username, !banned)}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold",
                            banned
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-600"
                          )}
                        >
                          <Ban size={16} />
                          {banned ? "Unban" : "Ban"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                Tidak ada data user.
              </div>
            )}
          </section>
        ) : null}

        {editUser ? (
          <div className="fixed inset-0 z-[90]">
            <button
              className="absolute inset-0 bg-black/35"
              onClick={() => setEditUser(null)}
              aria-label="Tutup"
            />
            <div className="absolute left-0 right-0 top-16 mx-auto w-full max-w-[520px] rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
              <div className="text-sm font-extrabold">
                Atur saldo: {editUser?.username}
              </div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                Mode set=ganti, add=tambah, sub=kurangi
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {["set", "add", "sub"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-xs font-extrabold",
                      mode === m
                        ? "border-[var(--yinn-border)] bg-black/5 dark:bg-white/5"
                        : "border-[var(--yinn-border)] text-[var(--yinn-muted)]"
                    )}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-3 py-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 50000"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                  inputMode="numeric"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditUser(null)}
                  className="rounded-xl border border-[var(--yinn-border)] py-2 text-sm font-extrabold"
                >
                  Batal
                </button>
                <button
                  onClick={submitBalance}
                  className="rounded-xl py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}