"use client";

import successAnimation from "@/animations/success.json";
import PaymentLayout from "@/components/PaymentLayout";
import Lottie from "lottie-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MobilePayData = {
  message?: string;
  status?: string;
  paid?: boolean;
  amount?: number;
  transaction_id?: string;
  expires_at?: string;
  server_time?: string;
  product?: {
    name?: string;
    description?: string;
  };
};

const API_BASE = "http://192.168.1.42:3000";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPaymentApproved(payload: MobilePayData) {
  const normalizedMessage = payload.message ? normalizeText(payload.message) : "";
  const normalizedStatus = payload.status ? normalizeText(payload.status) : "";

  return (
    payload.paid === true ||
    normalizedStatus === "approved" ||
    normalizedStatus === "paid" ||
    normalizedMessage.includes("pagamento ja confirmado")
  );
}

function vibrateOnSuccess() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(200);
      setTimeout(() => navigator.vibrate(120), 140);
    }
  } catch {
    // ignore unsupported environments
  }
}

export default function MobilePayPage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [data, setData] = useState<MobilePayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/orders/pix/${token}`)
      .then((res) => res.json())
      .then((result: MobilePayData) => {
        setData(result);

        if (isPaymentApproved(result)) {
          setShowSuccess(true);
          return;
        }

        if (result.expires_at && result.server_time) {
          const expires = new Date(result.expires_at).getTime();
          const now = new Date(result.server_time).getTime();
          setTimeLeft(Math.floor((expires - now) / 1000));
        }
      })
      .catch(() => {
        setError(true);
      });
  }, [token]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!showSuccess) return;
    vibrateOnSuccess();

    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [showSuccess, router]);

  async function confirmPayment() {
    if (loading || showSuccess || !token) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/orders/pix/${token}/confirm`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Falha ao confirmar pagamento.");
      }

      vibrateOnSuccess();
      setShowSuccess(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(seconds: number) {
    const safeSeconds = Math.max(seconds, 0);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  if (!data) {
    return (
      <PaymentLayout title="Confirmar pagamento" subtitle="Carregando dados do pagamento.">
        <div className="flex items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 p-10 text-neutral-300">
          Carregando pagamento...
        </div>
      </PaymentLayout>
    );
  }

  if (error) {
    return (
      <PaymentLayout title="Erro ao processar pagamento">
        <div className="rounded-2xl border border-red-400/60 bg-red-950/90 p-8 text-center shadow-xl backdrop-blur" role="alert" aria-live="assertive">
          <h1 className="text-xl font-bold text-red-300">Erro ao processar pagamento</h1>
          <p className="mt-2 text-sm text-red-100">Tente novamente em alguns instantes.</p>
        </div>
      </PaymentLayout>
    );
  }

  if (showSuccess) {
    return (
      <PaymentLayout title="Pagamento confirmado" subtitle="Obrigado pela sua compra.">
        <div className="p-2 text-center">
          <div className="mx-auto mb-4 w-[140px]">
            <Lottie animationData={successAnimation} loop={false} />
          </div>
          <p className="text-sm text-emerald-300">Pagamento confirmado no celular.</p>
        </div>
      </PaymentLayout>
    );
  }

  return (
    <PaymentLayout title="Pagamento PIX no celular" subtitle="Fluxo rapido e seguro para confirmar seu pedido.">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/85 p-5 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <span>Etapa 2 de 2</span>
          <span>Confirmacao PIX</span>
        </div>

        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
          <h2 className="text-lg font-semibold">{data.product?.name ?? "Produto"}</h2>
          {data.product?.description && <p className="mt-1 text-sm text-neutral-400">{data.product.description}</p>}
        </div>

        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-center">
          <p className="text-sm text-neutral-400">Valor</p>
          <p className="text-3xl font-bold">R$ {typeof data.amount === "number" ? (data.amount / 100).toFixed(2) : "0.00"}</p>
          {data.transaction_id && <p className="mt-2 text-xs text-neutral-500">Transacao: {data.transaction_id}</p>}
        </div>

        {timeLeft !== null && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-400/10 p-2 text-center text-sm text-amber-200">
            Expira em {formatTime(timeLeft)}
          </div>
        )}

        <p className="mb-4 text-center text-sm text-neutral-400">Toque em confirmar para finalizar o pagamento.</p>

        <button
          onClick={confirmPayment}
          disabled={loading || timeLeft === 0}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {loading ? "Processando pagamento..." : "Confirmar pagamento"}
        </button>
      </div>
    </PaymentLayout>
  );
}
