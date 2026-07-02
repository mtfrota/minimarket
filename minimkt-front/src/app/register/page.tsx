"use client";

import { apiFetch } from "@/lib/api";
import { setStoredUser } from "@/lib/session";
import { AuthUser } from "@/types/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type RegisterResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const clientValidation = useMemo(() => {
    if (!name.trim()) return "Nome e obrigatorio";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email invalido";
    if (password.length < 8) return "Senha deve ter no minimo 8 caracteres.";
    if (!/[A-Z]/.test(password)) return "Precisa ter letra maiuscula";
    if (!/[a-z]/.test(password)) return "Precisa ter letra minuscula";
    if (!/[0-9]/.test(password)) return "Precisa ter numeros";
    if (!/[^A-Za-z0-9]/.test(password)) return "Precisa ter caracter especial";
    if (password !== confirmPassword) return "As senhas nao coincidem";
    return "";
  }, [name, email, password, confirmPassword]);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (clientValidation) {
      setError(clientValidation);
      return;
    }

    setLoading(true);

    try {
      const createdUser = (await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      })) as RegisterResponse;

      const loginData = (await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })) as { accessToken: string; refreshToken: string; user?: AuthUser };

      localStorage.setItem("accessToken", loginData.accessToken);
      localStorage.setItem("refreshToken", loginData.refreshToken);

      if (loginData.user) {
        setStoredUser(loginData.user);
      } else {
        setStoredUser(createdUser);
      }

      const role = loginData.user?.role || createdUser.role;
      const destination = role === "seller" || role === "admin" ? "/seller" : "/";
      router.push(destination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <div className="glass-panel p-6 sm:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Comece agora</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Criar conta</h1>
          <p className="mt-2 text-sm text-neutral-400">Monte seu carrinho e finalize compras em poucos passos.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <label className="block text-sm text-neutral-300">
            Nome
            <input
              placeholder="Nome completo"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 outline-none transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

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
              type="password"
              placeholder="Senha forte"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4].map((level) => {
                const active = passwordStrength >= level;
                const isStrong = passwordStrength >= 4;
                return (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded ${active ? (isStrong ? "bg-emerald-400" : "bg-yellow-400") : "bg-neutral-700"}`}
                  />
                );
              })}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Forca da senha: {passwordStrength >= 4 ? "Forte" : passwordStrength >= 2 ? "Media" : "Fraca"}
            </p>
          </label>

          <label className="block text-sm text-neutral-300">
            Confirmar senha
            <input
              type="password"
              placeholder="Repita a senha"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 outline-none transition"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <button disabled={loading} className="ui-btn ui-btn-primary w-full">
            {loading ? "Cadastrando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-sm text-neutral-400">
          Ja possui conta?{" "}
          <Link href="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
