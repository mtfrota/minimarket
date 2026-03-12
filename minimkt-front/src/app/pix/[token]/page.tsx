"use client";

import successAnimation from "@/animations/success.json";
import PaymentLayout from "@/components/PaymentLayout";
import Lottie from "lottie-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type PixData = {
  qr_code?: string;
  message?: string;
  status?: string;
  paid?: boolean;
  amount?: number;
  transaction_id?: string;
};

const API_BASE = "http://192.168.1.42:3000";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPaymentApproved(payload: PixData) {
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
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([120, 60, 140]);
  }
}

export default function PixPage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [data, setData] = useState<PixData | null>(null);
  const [status, setStatus] = useState<"pending" | "approved" | "error">("pending");
  const [animateSuccess, setAnimateSuccess] = useState(false);
  const confirmedTrackedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/orders/pix/${token}`)
      .then((res) => res.json())
      .then((result: PixData) => {
        setData(result);

        if (isPaymentApproved(result)) {
          if (!confirmedTrackedRef.current) {
            confirmedTrackedRef.current = true;
          }
          setAnimateSuccess(true);
          setTimeout(() => setStatus("approved"), 300);
        } else if (result.qr_code) {
          setStatus("pending");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setData({ message: "Erro ao carregar pagamento." });
        setStatus("error");
      });
  }, [token]);

  useEffect(() => {
    if (status !== "pending" || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/orders/pix/${token}`);
        const updated = (await res.json()) as PixData;

        if (isPaymentApproved(updated)) {
          clearInterval(interval);
          if (!confirmedTrackedRef.current) {
            confirmedTrackedRef.current = true;
          }
          setAnimateSuccess(true);
          setTimeout(() => setStatus("approved"), 300);
        }
      } catch {
        // Mantem polling ativo; a tela principal continua utilizavel.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, token]);

  useEffect(() => {
    if (status !== "approved") return;
    vibrateOnSuccess();

    const timeout = setTimeout(() => {
      router.push("/");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [status, router]);

  if (!data) {
    return (
      <PaymentLayout title="Pague com PIX" subtitle="Aguarde o carregamento do pagamento.">
        <div className="flex items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 p-10 text-neutral-300">
          Carregando pagamento...
        </div>
      </PaymentLayout>
    );
  }

  if (status === "approved") {
    return (
      <PaymentLayout title="Pagamento confirmado" subtitle="Obrigado pela sua compra.">
        <div className="p-2 text-center">
          <div className="mx-auto mb-4 w-[140px]">
            <Lottie animationData={successAnimation} loop={false} />
          </div>
        </div>
      </PaymentLayout>
    );
  }

  if (status === "error") {
    return (
      <PaymentLayout title="Nao foi possivel carregar o pagamento">
        <div className="rounded-2xl border border-red-700/50 bg-red-500/10 p-8 text-center">
          <h1 className="text-xl font-bold text-red-300">Nao foi possivel carregar o pagamento</h1>
          <p className="mt-2 text-sm text-red-200">{data.message ?? "Tente novamente em alguns instantes."}</p>
        </div>
      </PaymentLayout>
    );
  }

  return (
    <PaymentLayout title="Pague com PIX" subtitle="Escaneie o QR Code para concluir o pagamento.">
      <div
        className={`mx-auto w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-2xl backdrop-blur transition-all duration-300 ${
          animateSuccess ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {data.qr_code ? (
          // O QR vem dinamico do backend e precisa de renderizacao direta.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.qr_code}
            alt="QR Code do pagamento"
            className="mx-auto mb-5 w-full max-w-[260px] rounded-xl border border-neutral-700 bg-white p-3"
          />
        ) : (
          <div className="mb-5 rounded-xl border border-neutral-700 bg-neutral-950/70 p-4 text-center text-sm text-neutral-300">
            QR Code indisponivel no momento.
          </div>
        )}

        {data.transaction_id && (
          <p className="mb-2 text-center text-xs text-neutral-400">Transacao: {data.transaction_id}</p>
        )}

        {typeof data.amount === "number" && (
          <p className="text-center text-sm text-neutral-300">
            Valor: <span className="font-semibold text-white">R$ {(data.amount / 100).toFixed(2)}</span>
          </p>
        )}
      </div>
    </PaymentLayout>
  );
}
