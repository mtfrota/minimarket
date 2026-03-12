"use client";

import { apiFetch } from "@/lib/api";
import { fetchCurrentUser, getStoredUser, setStoredUser } from "@/lib/session";
import { AuthUser } from "@/types/auth";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SettingsForm = {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  personalData: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const PERSONAL_DATA_KEY = "minimkt:personal-data";

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<SettingsForm>({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    personalData: "",
  });
  const [baseline, setBaseline] = useState<Pick<SettingsForm, "name" | "email" | "personalData">>({
    name: "",
    email: "",
    personalData: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const personalDataStorageKey = useMemo(() => (user ? `${PERSONAL_DATA_KEY}:${user.id}` : null), [user]);

  const hasUnsavedChanges = useMemo(
    () =>
      form.name !== baseline.name ||
      form.email !== baseline.email ||
      form.personalData !== baseline.personalData ||
      !!form.currentPassword ||
      !!form.newPassword ||
      !!form.confirmNewPassword,
    [form, baseline],
  );

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setForm((prev) => ({ ...prev, name: stored.name, email: stored.email }));
      setBaseline((prev) => ({ ...prev, name: stored.name, email: stored.email }));
    }

    fetchCurrentUser()
      .then((current) => {
        setUser(current);
        setForm((prev) => ({ ...prev, name: current.name, email: current.email }));
        setBaseline((prev) => ({ ...prev, name: current.name, email: current.email }));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Falha ao carregar perfil";
        showToast("error", message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!personalDataStorageKey) return;
    const localValue = localStorage.getItem(personalDataStorageKey) ?? "";
    setForm((prev) => ({ ...prev, personalData: localValue }));
    setBaseline((prev) => ({ ...prev, personalData: localValue }));
  }, [personalDataStorageKey]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      showToast("error", "Nome e email sao obrigatorios");
      return;
    }

    if (form.newPassword || form.confirmNewPassword) {
      if (!form.currentPassword) {
        showToast("error", "Informe a senha atual para alterar a senha");
        return;
      }
      if (form.newPassword !== form.confirmNewPassword) {
        showToast("error", "Confirmacao da nova senha nao confere");
        return;
      }
    }

    setSaving(true);

    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
      };

      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const response = (await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      })) as { message: string; user: AuthUser };

      setStoredUser(response.user);
      setUser(response.user);

      if (personalDataStorageKey) {
        localStorage.setItem(personalDataStorageKey, form.personalData);
      }

      setBaseline({
        name: response.user.name,
        email: response.user.email,
        personalData: form.personalData,
      });

      setForm((prev) => ({
        ...prev,
        name: response.user.name,
        email: response.user.email,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));

      showToast("success", "Configuracoes salvas com sucesso");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar configuracoes";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="relative rounded-2xl border border-white/10 bg-neutral-900/60 p-8 backdrop-blur">
      {toast && (
        <div
          className={`absolute right-4 top-4 rounded-lg px-3 py-2 text-sm shadow-lg ${
            toast.type === "success" ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
          }`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Configuracoes da conta</h1>
        {hasUnsavedChanges && <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-300">Nao salvo</span>}
      </div>
      <p className="mt-2 text-sm text-neutral-400">Atualize os dados basicos do comprador.</p>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-400">Carregando perfil...</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Nome
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="Nome completo" />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="voce@email.com" />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Senha atual
            <input type="password" value={form.currentPassword} onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))} className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="Senha atual" />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Nova senha
            <input type="password" value={form.newPassword} onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))} className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="Nova senha" />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-300 md:col-span-2">
            Confirmar nova senha
            <input type="password" value={form.confirmNewPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))} className="rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="Repita a nova senha" />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-300 md:col-span-2">
            Dados pessoais
            <textarea value={form.personalData} onChange={(e) => setForm((prev) => ({ ...prev, personalData: e.target.value }))} className="min-h-24 rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-emerald-400" placeholder="Telefone, CPF e outras observacoes" />
          </label>

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving || !hasUnsavedChanges} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar alteracoes"}
            </button>
            {!hasUnsavedChanges && <span className="text-sm text-neutral-400">Nenhuma alteracao pendente</span>}
          </div>
        </form>
      )}
    </section>
  );
}
