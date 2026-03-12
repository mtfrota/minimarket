"use client";

import { fetchCurrentUser, getStoredUser, logoutServerSession } from "@/lib/session";
import { getCartCount, getCartItems } from "@/lib/cart";
import { AuthUser } from "@/types/auth";
import { CartItem } from "@/types/cart";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationCenter from "@/components/NotificationCenter";

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Produtos", href: "/produtos" },
  { label: "Ofertas", href: "/#ofertas" },
  { label: "Contato", href: "/#contato" },
];

type UserAction = {
  id: "orders" | "history" | "settings" | "seller";
  label: string;
  href: string;
};

const BUYER_USER_ACTIONS: UserAction[] = [
  { id: "orders", label: "Meus pedidos", href: "/meus-pedidos" },
  { id: "history", label: "Historico de compras", href: "/historico-compras" },
  { id: "settings", label: "Configuracoes", href: "/configuracoes" },
];

function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M3 4h2l2.2 10.2a1.6 1.6 0 0 0 1.56 1.25h7.78a1.6 1.6 0 0 0 1.56-1.25L20 7H6.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.2" cy="19" r="1.1" />
      <circle cx="17.2" cy="19" r="1.1" />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function initialsFromName(name?: string | null) {
  const safeName = typeof name === "string" ? name : "";
  const parts = safeName.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Header() {
  const [userOpen, setUserOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loginPulse, setLoginPulse] = useState(false);
  const [mounted, setMounted] = useState(false);

  const userRef = useRef<HTMLDivElement | null>(null);
  const cartRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  function syncCart() {
    setCartCount(getCartCount());
    setCartItems(getCartItems());
  }

  const recentCartItems = useMemo(() => [...cartItems].reverse().slice(0, 3), [cartItems]);
  const cartSubtotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
    [cartItems],
  );
  const userActions = useMemo(() => {
    if (!user) return BUYER_USER_ACTIONS;

    if (user.role === "seller" || user.role === "admin") {
      return [{ id: "seller", label: "Painel Seller", href: "/seller" }, { id: "settings", label: "Configuracoes", href: "/configuracoes" }] as UserAction[];
    }

    return BUYER_USER_ACTIONS;
  }, [user]);

  const navLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        const isActive = item.href === "/produtos" ? pathname === "/produtos" : item.href === "/" ? pathname === "/" : false;
        const baseClassName = "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition";
        const activeClassName = isActive
          ? "bg-emerald-500/10 text-emerald-300"
          : "text-neutral-400 hover:bg-white/5 hover:text-white";

        return (
          <Link key={item.label} href={item.href} className={`${baseClassName} ${activeClassName}`}>
            {item.label}
          </Link>
        );
      }),
    [pathname],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserOpen(false);
        setCartOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    setMounted(true);

    const stored = getStoredUser();
    if (stored) setUser(stored);

    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      fetchCurrentUser().then(setUser).catch(() => setUser(null));
    }

    syncCart();

    const handleUserUpdated = () => setUser(getStoredUser());
    const handleCartUpdated = () => syncCart();
    const handleLoginRequired = () => {
      setLoginPulse(true);
      setTimeout(() => setLoginPulse(false), 1600);
    };

    window.addEventListener("user:updated", handleUserUpdated);
    window.addEventListener("cart:updated", handleCartUpdated);
    window.addEventListener("storage", handleCartUpdated);
    window.addEventListener("auth:login-required", handleLoginRequired);

    return () => {
      window.removeEventListener("user:updated", handleUserUpdated);
      window.removeEventListener("cart:updated", handleCartUpdated);
      window.removeEventListener("storage", handleCartUpdated);
      window.removeEventListener("auth:login-required", handleLoginRequired);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [mobileOpen, mounted]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setUserOpen(false);
    setMobileOpen(false);

    try {
      await logoutServerSession();
      setUser(null);
      syncCart();
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleUserAction(href: string) {
    setUserOpen(false);
    setMobileOpen(false);
    router.push(href);
  }

  function goToCart() {
    setCartOpen(false);
    setMobileOpen(false);
    router.push("/carrinho");
  }

  const displayName = user?.name?.trim() ? user.name : "buyer";
  const displayEmail = user?.email?.trim() ? user.email : "buyer@minimarket.local";

  const mobileDrawer = (
    <div className={`fixed inset-0 z-9999 transition ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div className="absolute inset-0 z-1 bg-black/75 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      <div
        className={`absolute right-0 top-0 z-2 h-full w-full sm:w-[86%] sm:max-w-sm border-l border-white/10 p-4 shadow-2xl transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ backgroundColor: "#050505" }}
      >
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Menu</p>
            <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg px-2 py-1 text-neutral-300 hover:bg-white/10">Fechar</button>
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-neutral-200 transition hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-neutral-400">Carrinho</p>
            <p className="text-sm text-neutral-300">Itens: {cartCount}</p>
            <p className="text-sm text-neutral-300">Subtotal: {formatMoney(cartSubtotal)}</p>
            <button type="button" onClick={goToCart} className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black">
              Ir para carrinho
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-neutral-400">Aparencia</p>
            <ThemeToggle className="h-9 w-9" />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 p-3">
            {user ? (
              <>
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <p className="text-xs text-neutral-400">{displayEmail}</p>
                <div className="mt-3 space-y-1">
                  {userActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleUserAction(action.href)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-200 transition hover:bg-white/5"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="mt-3 w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"
                >
                  {isLoggingOut ? "Saindo..." : "Sair"}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg border px-3 py-2 text-center text-sm text-neutral-200 ${
                  loginPulse ? "animate-[pulse_0.7s_ease-in-out_2] border-emerald-300 bg-emerald-500/15 text-emerald-200" : "border-white/10"
                }`}
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:h-20 lg:px-8">
        <Link href="/" className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-white/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <span className="text-lg font-bold text-emerald-400">M</span>
          </div>
          <span className="text-lg font-semibold tracking-wide text-white">MiniMarket</span>
        </Link>

        <nav className="mx-10 hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/2 p-1">{navLinks}</div>
          <div className="ml-3">
            <NotificationCenter />
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden lg:flex" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Abrir menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          {user ? (
            <div className="relative hidden lg:block" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((p) => !p)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/2 px-3 py-2 text-neutral-300 transition duration-200 hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-neutral-700 to-neutral-900 text-xs font-semibold ring-1 ring-white/10">
                  {initialsFromName(displayName)}
                </div>
                <span className="text-sm font-medium">{displayName}</span>
                <svg className={`h-4 w-4 transition-transform duration-200 ${userOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              <div
                className={`absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-white/10 bg-neutral-900/95 p-2 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
                  userOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                }`}
              >
                <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-3">
                  <p className="text-sm font-semibold text-white">{displayName}</p>
                  <p className="text-xs text-neutral-400">{displayEmail}</p>
                </div>

                <div className="py-2 text-sm">
                  {userActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleUserAction(action.href)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-neutral-300 transition hover:bg-white/5 hover:text-white"
                    >
                      <span>{action.label}</span>
                      <span className="text-xs text-neutral-500">Abrir</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full rounded-lg px-3 py-2 text-left text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoggingOut ? "Saindo..." : "Sair"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className={`hidden rounded-xl border bg-white/[0.02] px-3 py-2 text-sm text-neutral-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white lg:block ${
                loginPulse ? "animate-[pulse_0.7s_ease-in-out_2] border-emerald-300 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_3px_rgba(16,185,129,0.28)]" : "border-white/10"
              }`}
            >
              Entrar
            </Link>
          )}

          <div className="relative" ref={cartRef}>
            <button
              type="button"
              onClick={() => setCartOpen((prev) => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-white/5 hover:text-white"
              aria-label="Abrir mini carrinho"
            >
              <CartIcon className="h-5 w-5" />
              <motion.span
                key={cartCount}
                initial={{ scale: 0.7, y: -2 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black"
              >
                {cartCount}
              </motion.span>
            </button>

            <div
              className={`absolute right-0 mt-2 w-80 origin-top-right rounded-2xl border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
                cartOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Mini carrinho</p>
                <p className="text-xs text-neutral-400">{cartCount} item(ns)</p>
              </div>

              {recentCartItems.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-neutral-400">Seu carrinho esta vazio.</p>
              ) : (
                <div className="space-y-2">
                  {recentCartItems.map((item) => (
                    <div key={`${item.productId}-${item.quantity}`} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p className="text-sm text-white">{item.title}</p>
                      <p className="text-xs text-neutral-400">{item.quantity} x {formatMoney(item.unitPrice)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="font-semibold text-white">{formatMoney(cartSubtotal)}</span>
              </div>

              <button
                type="button"
                onClick={goToCart}
                className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                Ir para carrinho
              </button>
            </div>
          </div>
        </div>
      </div>

      {mounted ? createPortal(mobileDrawer, document.body) : null}
    </header>
  );
}
