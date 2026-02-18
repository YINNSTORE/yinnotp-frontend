"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Smartphone, Clock, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname() || "";

  const items = [
    { href: "/dashboard", label: "Home", Icon: Home },
    { href: "/order", label: "Order", Icon: Smartphone },
    // kolom tengah buat FAB (spacer)
    { href: "/dashboard/activity", label: "Activity", Icon: Clock },
    { href: "/dashboard/profile", label: "Profile", Icon: User },
  ];

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
        background: "rgba(255,255,255,.82)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(15,23,42,.08)",
      }}
    >
      <div
        className="mx-auto max-w-[520px] rounded-[18px] px-2 py-2"
        style={{
          background: "rgba(255,255,255,.92)",
          boxShadow: "0 14px 34px rgba(2,6,23,.12)",
          position: "relative",
        }}
      >
        <div className="grid grid-cols-5 items-center gap-1">
          {/* left 2 */}
          {items.slice(0, 2).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={[
                "h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-1 select-none",
                isActive(href)
                  ? "text-[var(--yinn-text)]"
                  : "text-[var(--yinn-muted)]",
              ].join(" ")}
              style={
                isActive(href)
                  ? { background: "rgba(67,97,238,.10)" }
                  : { background: "transparent" }
              }
            >
              <Icon size={18} />
              <span className="text-[11px] font-semibold leading-none">
                {label}
              </span>
            </Link>
          ))}

          {/* spacer */}
          <div className="h-[52px]" aria-hidden="true" />

          {/* right 2 */}
          {items.slice(2, 4).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={[
                "h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-1 select-none",
                isActive(href)
                  ? "text-[var(--yinn-text)]"
                  : "text-[var(--yinn-muted)]",
              ].join(" ")}
              style={
                isActive(href)
                  ? { background: "rgba(67,97,238,.10)" }
                  : { background: "transparent" }
              }
            >
              <Icon size={18} />
              <span className="text-[11px] font-semibold leading-none">
                {label}
              </span>
            </Link>
          ))}
        </div>

        {/* FAB tengah */}
        <Link
          href="/order"
          aria-label="Buat order OTP"
          className="grid place-items-center"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translate(-50%, -18px)",
            width: 62,
            height: 62,
            borderRadius: 18,
            background:
              "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
            boxShadow: "0 16px 34px rgba(67,97,238,.32)",
            border: "1px solid rgba(255,255,255,.35)",
            color: "white",
          }}
        >
          <span style={{ fontSize: 20, transform: "translateY(-1px)" }}>
            ☄𔓎
          </span>
        </Link>
      </div>
    </nav>
  );
}