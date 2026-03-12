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

      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-neutral-900 p-6 rounded border border-neutral-800">
      <h1 className="text-xl font-bold mb-6">Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="mt-1 text-xs text-neutral-400 transition hover:text-neutral-200"
          >
            {showPassword ? "Ocultar senha" : "Mostrar senha"}
          </button>
        </div>

        {error && <p className="text-red-300 text-sm" role="alert" aria-live="assertive">{error}</p>}

        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-400">
        Nao tem conta?{" "}
        <Link href="/register" className="text-emerald-400 hover:text-emerald-300">
          Cadastrar
        </Link>
      </p>
    </div>
  );
}
