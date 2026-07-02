"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setStoredUser } from "@/lib/session";
import { AuthUser } from "@/types/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = (await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })) as { accessToken: string; refreshToken: string; user?: AuthUser };

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      if (data.user) {
        setStoredUser(data.user);
      }

      const destination = data.user?.role === "seller" || data.user?.role === "admin" ? "/seller" : "/";
      router.push(destination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md">
      <div className="glass-panel p-6 sm:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">MiniMarket</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Entrar na conta</h1>
          <p className="mt-2 text-sm text-neutral-400">Acesse pedidos, carrinho e painel de vendas.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm text-neutral-300">
            Email
            <input
              type="email"
              placeholder="voce@email.com"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block text-sm text-neutral-300">
            Senha
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="mt-2 text-xs font-medium text-emerald-300 transition hover:text-emerald-200"
            >
              {showPassword ? "Ocultar senha" : "Mostrar senha"}
            </button>
          </label>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert" aria-live="assertive">{error}</p>}

          <button disabled={loading} className="ui-btn ui-btn-primary w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-5 text-sm text-neutral-400">
          Nao tem conta?{" "}
          <Link href="/register" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
