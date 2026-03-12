"use client";

import successAnimation from "@/animations/success.json";
import PaymentLayout from "@/components/PaymentLayout";
import Lottie from "lottie-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DebitData = {
  message?: string;
  amount?: number;
  transaction_id?: string;
  expires_at?: string;
  server_time?: string;
  product?: { name?: string; description?: string };
  status?: string;
  paid?: boolean;
};

const API_BASE = "http://192.168.1.42:3000";

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

export default function MobileDebitPage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [data, setData] = useState<DebitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const isExpired = timeLeft === 0;

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/orders/debit/${token}`)
      .then((res) => res.json())
      .then((result: DebitData) => {
        setData(result);
        if (result.paid || result.status === "approved") {
          setShowSuccess(true);
          return;
        }
        if (result.expires_at && result.server_time) {
          const expires = new Date(result.expires_at).getTime();
          const now = new Date(result.server_time).getTime();
          setTimeLeft(Math.max(Math.floor((expires - now) / 1000), 0));
        }
      })
      .catch(() => {
        setError("Erro ao carregar pagamento.");
      });
  }, [token]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => (prev && prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!showSuccess) return;
    vibrateOnSuccess();
  }, [showSuccess]);

  async function confirmPayment() {
    if (!token || loading || showSuccess) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/orders/debit/${token}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error("Falha na confirmacao");
      vibrateOnSuccess();
      setShowSuccess(true);
    } catch {
      setError("Nao foi possivel confirmar pagamento.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <PaymentLayout title="Confirmar pagamento no debito" subtitle="Carregando dados do pagamento.">
        <div className="flex items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 p-10 text-neutral-300">
          Carregando...
        </div>
      </PaymentLayout>
    );
  }

  if (showSuccess) {
    return (
      <PaymentLayout title="Pagamento confirmado" subtitle="Obrigado pela sua compra." maxWidthClass="max-w-xl">
        <div className="p-2 text-center">
          <div className="mx-auto mb-4 w-[130px]"><Lottie animationData={successAnimation} loop={false} /></div>
          <button onClick={() => router.push("/")} className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black">Voltar ao inicio</button>
        </div>
      </PaymentLayout>
    );
  }

  return (
    <PaymentLayout title="Pagamento no debito no celular" maxWidthClass="max-w-xl" subtitle="Confirme o QR gerado no checkout para concluir.">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/85 p-5 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <span>Etapa 2 de 2</span>
          <span>Confirmacao Debito</span>
        </div>

        <div aria-live="polite" className="sr-only">
          {loading ? "Confirmando pagamento..." : ""}
        </div>
        <div aria-live="assertive" className="sr-only">
          {error ? error : isExpired ? "QR expirado." : ""}
        </div>

        {error && (
          <div className="mt-2 rounded-lg border border-red-400/60 bg-red-950/90 p-3 text-sm text-red-100 shadow-lg backdrop-blur" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        {isExpired && (
          <div className="mt-2 rounded-lg border border-amber-400/60 bg-amber-950/80 p-3 text-sm text-amber-100 shadow-lg backdrop-blur" role="alert" aria-live="assertive">
            QR expirado. Gere um novo QR no checkout para continuar.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
          <p className="font-semibold">{data.product?.name ?? "Produto"}</p>
          {data.product?.description && <p className="mt-1 text-sm text-neutral-400">{data.product.description}</p>}
          <p className="mt-3 text-sm text-neutral-300">Valor: <span className="font-semibold text-white">R$ {typeof data.amount === "number" ? (data.amount / 100).toFixed(2) : "0,00"}</span></p>
          {timeLeft !== null && <p className="mt-1 text-sm text-amber-300">Expira em {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</p>}
          {data.transaction_id && <p className="mt-1 text-xs text-neutral-500">Transacao: {data.transaction_id}</p>}
        </div>

        <button
          onClick={confirmPayment}
          disabled={loading || isExpired}
          className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-semibold text-black disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {loading ? "Confirmando..." : "Confirmar pagamento"}
        </button>
      </div>
    </PaymentLayout>
  );
}
