"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, SunMedium } from "lucide-react";

const STORAGE_KEY = "yinnotp:theme"; // light | dark | system

function applyTheme(mode) {
  const root = document.documentElement;

  if (mode === "system") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    return;
  }

  root.setAttribute("data-theme", mode);
}

export default function ThemeMenu() {
  const [mode, setMode] = useState("light");

  const items = useMemo(
    () => [
      { key: "light", label: "Light", icon: SunMedium },
      { key: "dark", label: "Dark", icon: Moon },
      { key: "system", label: "System", icon: Monitor },
    ],
    []
  );

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const initial = saved || "light";
    setMode(initial);
    applyTheme(initial);

    // kalau system, ikut perubahan OS
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = localStorage.getItem(STORAGE_KEY) || "light";
      if (current === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const setAndApply = (next) => {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const ActiveIcon = items.find((x) => x.key === mode)?.icon ?? SunMedium;

  return (
    <div className="relative">
      <details className="group">
        <summary
          className="list-none cursor-pointer select-none flex items-center gap-2 rounded-xl border px-3 py-2
                     bg-[var(--yinn-surface)] text-[var(--yinn-text)] border-[var(--yinn-border)]
                     shadow-[var(--yinn-soft)]"
        >
          <ActiveIcon size={18} />
          <span className="hidden sm:inline text-sm font-medium">Theme</span>
          <span className="opacity-60 text-sm">▾</span>
        </summary>

        <div
          className="absolute right-0 mt-2 w-44 rounded-xl border bg-[var(--yinn-surface)]
                     border-[var(--yinn-border)] shadow-[var(--yinn-soft)] overflow-hidden z-50"
        >
          {items.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAndApply(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                         hover:bg-black/5 dark:hover:bg-white/5
                         ${mode === key ? "font-semibold" : "font-medium"}
                         text-[var(--yinn-text)]`}
              type="button"
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}