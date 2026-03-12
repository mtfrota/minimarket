"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, ThemeMode, toggleTheme } from "@/lib/theme";

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);

    const handleThemeChange = () => {
      setTheme(getStoredTheme());
    };

    window.addEventListener("theme:changed", handleThemeChange);
    return () => window.removeEventListener("theme:changed", handleThemeChange);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((current) => toggleTheme(current))}
      className={`relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-neutral-300 transition hover:bg-white/10 hover:text-white ${className}`}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
