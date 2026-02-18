"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, ShoppingBag, User } from "lucide-react";

function Item({ href, active, icon: Icon, label }) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center justify-center gap-1",
        active ? "text-[var(--yinn-text)]" : "text-[var(--yinn-muted)]",
      ].join(" ")}
    >
      <Icon size={18} />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
      <div className="mx-auto grid max-w-[520px] grid-cols-3 items-center px-6 py-3">
        <Item
          href="/dashboard"
          active={pathname === "/dashboard"}
          icon={Home}
          label="Home"
        />

        {/* center FAB */}
        <div className="flex justify-center">
          <Link
            href="/order"
            className="grid h-14 w-14 -translate-y-5 place-items-center rounded-2xl text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              boxShadow: "var(--yinn-soft)",
            }}
            aria-label="Order OTP"
            title="Order OTP"
          >
            <ShoppingBag size={20} />
          </Link>
        </div>

        <div className="flex items-center justify-end gap-7">
          <Item
            href="/topup"
            active={pathname === "/topup"}
            icon={Wallet}
            label="Deposit"
          />
          <Item
            href="/login"
            active={pathname === "/login"}
            icon={User}
            label="Profile"
          />
        </div>
      </div>
    </nav>
  );
}