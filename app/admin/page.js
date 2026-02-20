"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { adminUsersList, adminBalanceSet, adminBanSet } from "../_lib/adminClient";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [editUser, setEditUser] = useState(null);
  const [newBalance, setNewBalance] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await adminUsersList({ limit, offset, q: q.trim() });
      if (!r.ok || !r.json?.ok) {
        toast.error(r.json?.message || "Gagal load user (cek token admin)");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(r.json?.data?.items) ? r.json.data.items : []);
      setTotal(Number(r.json?.data?.total || 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const picked = useMemo(() => {
    if (!editUser) return null;
    return items.find((x) => x.username === editUser) || null;
  }, [editUser, items]);

  async function onSetBalance() {
    if (!picked) return;
    const n = Number(newBalance);
    if (!Number.isFinite(n) || n < 0) return toast.error("Balance tidak valid");

    setSaving(true);
    try {
      const r = await adminBalanceSet(picked.username, Math.floor(n));
      if (!r.ok || !r.json?.ok) return toast.error(r.json?.message || "Gagal set saldo");
      toast.success("Saldo diupdate");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onToggleBan() {
    if (!picked) return;
    const next = !Boolean(picked.is_banned);

    setSaving(true);
    try {
      const r = await adminBanSet(picked.username, next);
      if (!r.ok || !r.json?.ok) return toast.error(r.json?.message || "Gagal ban/unban");
      toast.success(next ? "User dibanned" : "User di-unban");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[900px] p-4">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <div className="text-lg font-extrabold">Admin Control Panel</div>
          <div className="mt-1 text-xs text-[var(--yinn-muted)]">
            Kelola user: saldo & ban/unban.
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari username..."
              className="w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => {
                setOffset(0);
                load();
              }}
              className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold"
              disabled={loading}
            >
              Cari
            </button>

            <div className="ms-auto flex items-center gap-2">
              <button
                onClick={() => canPrev && setOffset((x) => Math.max(0, x - limit))}
                className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold disabled:opacity-50"
                disabled={!canPrev || loading}
              >
                Prev
              </button>
              <button
                onClick={() => canNext && setOffset((x) => x + limit)}
                className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold disabled:opacity-50"
                disabled={!canNext || loading}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-[var(--yinn-muted)]">
            Total: <span className="font-bold">{total}</span> • Showing:{" "}
            <span className="font-bold">{items.length}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
            <div className="border-b border-[var(--yinn-border)] p-3 text-sm font-extrabold">
              Daftar User
            </div>

            {loading ? (
              <div className="p-3 text-sm text-[var(--yinn-muted)]">Loading…</div>
            ) : (
              <div className="divide-y divide-[var(--yinn-border)]">
                {items.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => {
                      setEditUser(u.username);
                      setNewBalance(String(u.balance_idr ?? 0));
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5",
                      editUser === u.username ? "bg-black/5 dark:bg-white/5" : ""
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold">
                        {u.username}{" "}
                        <span className="ms-2 rounded-full border border-[var(--yinn-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--yinn-muted)]">
                          {u.role}
                        </span>
                        {u.is_banned ? (
                          <span className="ms-2 rounded-full border border-[var(--yinn-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--yinn-muted)]">
                            BANNED
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--yinn-muted)]">
                        Saldo: <span className="font-bold">{formatIDR(u.balance_idr)}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {!items.length ? (
                  <div className="p-3 text-sm text-[var(--yinn-muted)]">Tidak ada data.</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
            <div className="text-sm font-extrabold">Aksi</div>
            <div className="mt-1 text-xs text-[var(--yinn-muted)]">
              Pilih user di kiri buat edit.
            </div>

            {picked ? (
              <>
                <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] p-3">
                  <div className="text-xs text-[var(--yinn-muted)]">User</div>
                  <div className="mt-1 text-sm font-extrabold">{picked.username}</div>
                  <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                    Role: <span className="font-bold">{picked.role}</span> • Status:{" "}
                    <span className="font-bold">{picked.is_banned ? "BANNED" : "ACTIVE"}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-extrabold text-[var(--yinn-muted)]">Set Saldo (IDR)</div>
                  <input
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-2 text-sm outline-none"
                    inputMode="numeric"
                  />

                  <button
                    onClick={onSetBalance}
                    disabled={saving}
                    className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    Simpan Saldo
                  </button>
                </div>

                <button
                  onClick={onToggleBan}
                  disabled={saving}
                  className="mt-3 w-full rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold disabled:opacity-60"
                >
                  {picked.is_banned ? "Unban User" : "Ban User"}
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-3 text-sm text-[var(--yinn-muted)]">
                Belum ada user dipilih.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}