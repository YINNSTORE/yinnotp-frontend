"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import BottomNav from "../../components/BottomNav";
import ThemeMenu from "../../components/ThemeMenu";
import { Camera, LogOut, Save, Settings, User2 } from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function getActiveUserId() {
  return (
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("yinnotp_username") ||
    localStorage.getItem("username") ||
    ""
  );
}

function normBackend(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function getTokenForUser(uid) {
  const last = safeJson(localStorage.getItem("yinnotp:last_session"));
  return (
    localStorage.getItem("yinnotp_token") ||
    localStorage.getItem("yinnotp_token_active") ||
    (uid ? localStorage.getItem(`yinnotp_token:${uid}`) : "") ||
    last?.token ||
    ""
  );
}

function authHeaders(uid, token) {
  const h = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
    h["X-Token"] = token;
  }
  return h;
}

function avatarKey(uid) {
  return `yinnotp_avatar:${uid || "default"}`;
}

function profileKey(uid) {
  return `yinnotp_profile:${uid || "default"}`;
}

function balanceKey(uid) {
  return `yinnotp_balance:${uid || "default"}`;
}

function initialFromName(name) {
  const s = String(name || "").trim();
  if (!s) return "U";
  return s[0].toUpperCase();
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const backend = normBackend(process.env.NEXT_PUBLIC_BACKEND_URL);

  const [tab, setTab] = useState("profile");
  const [uid, setUid] = useState("");
  const [balance, setBalance] = useState(0);

  const [avatar, setAvatar] = useState("");
  const fileRef = useRef(null);

  const [view, setView] = useState({
    id: "—",
    username: "—",
    name: "User",
    email: "—",
    telegram_id: "—",
    whatsapp: "—",
    created_at: null,
    last_login: null,
    orders: 0,
    deposits: 0,
    ppob: 0,
  });

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    telegram_id: "",
    whatsapp: "",
  });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const stats = useMemo(
    () => [
      { label: "Orders", value: view.orders ?? 0 },
      { label: "Deposit", value: view.deposits ?? 0 },
      { label: "PPOB", value: view.ppob ?? 0 },
    ],
    [view.orders, view.deposits, view.ppob]
  );

  function loadLocal(u) {
    const p = safeJson(localStorage.getItem(profileKey(u)));
    const name =
      p?.name ||
      localStorage.getItem("yinnotp_name") ||
      localStorage.getItem("name") ||
      "User";
    const username =
      p?.username ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("username") ||
      "—";
    const email = p?.email || localStorage.getItem("yinnotp_email") || "—";
    const telegram_id = p?.telegram_id || "—";
    const whatsapp = p?.whatsapp || "—";
    const id = p?.id || localStorage.getItem("yinnotp_user_id") || u || "—";

    const b =
      Number(String(localStorage.getItem(balanceKey(u)) || "0").replace(/[^\d]/g, "")) ||
      Number(String(localStorage.getItem("yinnotp_balance") || "0").replace(/[^\d]/g, "")) ||
      0;

    const av = localStorage.getItem(avatarKey(u)) || "";

    setBalance(b);
    setAvatar(av);

    setView((v) => ({
      ...v,
      id,
      username,
      name,
      email,
      telegram_id,
      whatsapp,
      created_at: p?.created_at ?? v.created_at,
      last_login: p?.last_login ?? v.last_login,
      orders: Number(p?.orders ?? v.orders ?? 0) || 0,
      deposits: Number(p?.deposits ?? v.deposits ?? 0) || 0,
      ppob: Number(p?.ppob ?? v.ppob ?? 0) || 0,
    }));

    setForm({
      name: name === "—" ? "" : name,
      username: username === "—" ? "" : username,
      email: email === "—" ? "" : email,
      telegram_id: telegram_id === "—" ? "" : telegram_id,
      whatsapp: whatsapp === "—" ? "" : whatsapp,
    });
  }

  async function trySyncRemote(u) {
    const token = getTokenForUser(u);
    if (!backend || !u || !token) return;

    try {
      const r = await fetch(`${backend}/user/me?user_id=${encodeURIComponent(u)}`, {
        cache: "no-store",
        headers: authHeaders(u, token),
      });
      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j) return;

      const merged = {
        id: j?.id ?? j?.user_id ?? u,
        username: j?.username ?? j?.name ?? localStorage.getItem("yinnotp_username") ?? "—",
        name: j?.name ?? localStorage.getItem("yinnotp_name") ?? "User",
        email: j?.email ?? "—",
        telegram_id: j?.telegram_id ?? "—",
        whatsapp: j?.whatsapp ?? "—",
        created_at: j?.created_at ?? null,
        last_login: j?.last_login ?? null,
        orders: Number(j?.orders ?? 0) || 0,
        deposits: Number(j?.deposits ?? 0) || 0,
        ppob: Number(j?.ppob ?? 0) || 0,
      };

      localStorage.setItem(profileKey(u), JSON.stringify(merged));

      if (typeof j?.balance !== "undefined") {
        localStorage.setItem(balanceKey(u), String(j.balance || 0));
        localStorage.setItem("yinnotp_balance", String(j.balance || 0));
        setBalance(Number(j.balance || 0) || 0);
      }

      loadLocal(u);
    } catch {}
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = getActiveUserId();
    setUid(u);
    loadLocal(u);
    trySyncRemote(u);
  }, []);

  async function onPickAvatar(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const okType =
      file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg";
    if (!okType) {
      toast.error("Format harus PNG / JPG");
      return;
    }
    if (file.size > 800 * 1024) {
      toast.error("Max size 800KB");
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      localStorage.setItem(avatarKey(uid), dataUrl);
      setAvatar(dataUrl);
      toast.success("Foto tersimpan");
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAvatar() {
    localStorage.removeItem(avatarKey(uid));
    setAvatar("");
    toast.success("Foto dihapus");
  }

  async function saveProfile() {
    const next = {
      ...safeJson(localStorage.getItem(profileKey(uid))),
      id: view.id,
      username: String(form.username || "").trim() || view.username,
      name: String(form.name || "").trim() || view.name,
      email: String(form.email || "").trim() || view.email,
      telegram_id: String(form.telegram_id || "").trim() || "—",
      whatsapp: String(form.whatsapp || "").trim() || "—",
      created_at: view.created_at,
      last_login: view.last_login,
      orders: view.orders,
      deposits: view.deposits,
      ppob: view.ppob,
    };

    setSavingProfile(true);
    try {
      localStorage.setItem(profileKey(uid), JSON.stringify(next));
      localStorage.setItem("yinnotp_name", next.name);
      localStorage.setItem("yinnotp_username", next.username);

      const token = getTokenForUser(uid);
      if (backend && uid && token) {
        try {
          await fetch(`${backend}/user/profile`, {
            method: "POST",
            headers: authHeaders(uid, token),
            body: JSON.stringify({
              user_id: uid,
              name: next.name,
              username: next.username,
              email: next.email,
              telegram_id: next.telegram_id,
              whatsapp: next.whatsapp,
            }),
          });
        } catch {}
      }

      loadLocal(uid);
      toast.success("Profile tersimpan");
      setTab("profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePassword() {
    const cur = String(pw.current || "");
    const next = String(pw.next || "");
    const conf = String(pw.confirm || "");

    if (!cur || !next || !conf) {
      toast.error("Lengkapi semua field");
      return;
    }
    if (next.length < 8) {
      toast.error("Minimal 8 karakter");
      return;
    }
    if (!/[A-Z]/.test(next) || !/[0-9]/.test(next)) {
      toast.error("Butuh 1 huruf besar + 1 angka");
      return;
    }
    if (next !== conf) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }

    setSavingPw(true);
    try {
      const token = getTokenForUser(uid);

      if (backend && uid && token) {
        const r = await fetch(`${backend}/user/password`, {
          method: "POST",
          headers: authHeaders(uid, token),
          body: JSON.stringify({ user_id: uid, current_password: cur, new_password: next }),
        });
        const t = await r.text();
        const j = safeJson(t);
        if (!r.ok || j?.ok === false) {
          toast.error(j?.message || "Gagal update password");
          return;
        }
      }

      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch {
      toast.error("Server error");
    } finally {
      setSavingPw(false);
    }
  }

  function logout() {
    try {
      const u = getActiveUserId();
      localStorage.removeItem("yinnotp_token");
      localStorage.removeItem("yinnotp_token_active");
      if (u) localStorage.removeItem(`yinnotp_token:${u}`);
      localStorage.removeItem("yinnotp:last_session");
      localStorage.removeItem("yinnotp_active_user");
    } catch {}
    toast.success("Logout");
    window.location.href = "/login";
  }

  const dtFmt = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight">Profile</div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {uid ? `ID: ${uid}` : "—"}
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <div
              className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              style={{ boxShadow: "var(--yinn-soft)" }}
            >
              <span className="text-[11px] font-semibold text-[var(--yinn-muted)]">Saldo </span>
              {formatIDR(balance)}
            </div>
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("profile")}
            className={[
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold",
              tab === "profile"
                ? "border-transparent text-white"
                : "border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
            ].join(" ")}
            style={
              tab === "profile"
                ? { background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }
                : { boxShadow: "var(--yinn-soft)" }
            }
          >
            <User2 size={16} /> Profile
          </button>

          <button
            onClick={() => setTab("setting")}
            className={[
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold",
              tab === "setting"
                ? "border-transparent text-white"
                : "border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
            ].join(" ")}
            style={
              tab === "setting"
                ? { background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }
                : { boxShadow: "var(--yinn-soft)" }
            }
          >
            <Settings size={16} /> Setting
          </button>

          <div className="ms-auto" />
        </div>

        {tab === "profile" ? (
          <section
            className="mt-4 rounded-2xl border p-4"
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="grid place-items-center">
              <div className="relative">
                <div
                  className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border"
                  style={{
                    borderColor: "var(--yinn-border)",
                    background: "rgba(67,97,238,.10)",
                  }}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="avatar"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-4xl font-extrabold text-[var(--yinn-text)]">
                      {initialFromName(view.name)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border border-[var(--yinn-border)] bg-[var(--yinn-surface)]"
                  style={{ boxShadow: "var(--yinn-soft)" }}
                  aria-label="Upload"
                  title="Upload"
                >
                  <Camera size={16} />
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onPickAvatar}
                />
              </div>

              <div className="mt-3 text-center">
                <div className="text-lg font-extrabold">{view.username}</div>
                <div className="text-sm text-[var(--yinn-muted)]">{view.name}</div>

                <div className="mt-3 flex items-center justify-center gap-6">
                  {stats.map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-base font-extrabold">{Number(s.value || 0)}</div>
                      <div className="text-xs text-[var(--yinn-muted)]">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--yinn-border)] pt-4 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">ID</span>
                  <span className="font-extrabold">{view.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Username</span>
                  <span className="font-extrabold">{view.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Name</span>
                  <span className="font-extrabold">{view.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Email</span>
                  <span className="font-extrabold">{view.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Telegram ID</span>
                  <span className="font-extrabold">{view.telegram_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">WhatsApp</span>
                  <span className="font-extrabold">{view.whatsapp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Account Created</span>
                  <span className="font-extrabold">{dtFmt(view.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Last Login</span>
                  <span className="font-extrabold">{dtFmt(view.last_login)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setTab("setting")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              >
                <Settings size={16} /> Edit Profile
              </button>

              <button
                onClick={logout}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-bold"
              >
                Upload
              </button>
              <button
                onClick={removeAvatar}
                className="flex-1 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-bold"
              >
                Remove
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-4 space-y-3">
            <div
              className="rounded-2xl border p-4"
              style={{
                background: "var(--yinn-surface)",
                borderColor: "var(--yinn-border)",
                boxShadow: "var(--yinn-soft)",
              }}
            >
              <div className="text-sm font-extrabold">Edit Profile</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                Allowed JPG, PNG. Max size 800K
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Name</div>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="Nama"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Username</div>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="Username"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Email</div>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="Email"
                    inputMode="email"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Telegram ID</div>
                  <input
                    value={form.telegram_id}
                    onChange={(e) => setForm((f) => ({ ...f, telegram_id: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="id user"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">WhatsApp Number</div>
                  <input
                    value={form.whatsapp}
                    onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="+62..."
                    inputMode="tel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => loadLocal(uid)}
                    className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                  >
                    Reset
                  </button>
                  <button
                    disabled={savingProfile}
                    onClick={saveProfile}
                    className="rounded-xl px-3 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <Save size={16} /> {savingProfile ? "Saving..." : "Save"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                background: "var(--yinn-surface)",
                borderColor: "var(--yinn-border)",
                boxShadow: "var(--yinn-soft)",
              }}
            >
              <div className="text-sm font-extrabold">Change Password</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                Minimum 8 characters, at least 1 uppercase, at least 1 number
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Current Password</div>
                  <input
                    type="password"
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">New Password</div>
                  <input
                    type="password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Confirm New Password</div>
                  <input
                    type="password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setPw({ current: "", next: "", confirm: "" })}
                    className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingPw}
                    onClick={updatePassword}
                    className="rounded-xl px-3 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    {savingPw ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}