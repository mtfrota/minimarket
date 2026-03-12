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

      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-neutral-900 p-6 rounded border border-neutral-800">
      <h1 className="text-xl font-bold mb-6">Cadastro</h1>

      <form onSubmit={handleRegister} className="space-y-4">
        <input
          placeholder="Nome"
          className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <input
            type="password"
            placeholder="Senha"
            className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
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
                  className={`h-1.5 flex-1 rounded ${active ? (isStrong ? "bg-emerald-500" : "bg-yellow-400") : "bg-neutral-700"}`}
                />
              );
            })}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Forca da senha: {passwordStrength >= 4 ? "Forte" : passwordStrength >= 2 ? "Media" : "Fraca"}
          </p>
        </div>

        <input
          type="password"
          placeholder="Confirmar senha"
          className="w-full p-2 rounded bg-neutral-800 border border-neutral-700"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 p-2 rounded font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Cadastrando..." : "Criar conta"}
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-400">
        Ja possui conta?{" "}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
          Entrar
        </Link>
      </p>
    </div>
  );
}
