"use client";

import successAnimation from "@/animations/success.json";
import PaymentLayout from "@/components/PaymentLayout";
import {
  CARD_RULES,
  cardBrandLabel,
  detectCardBrand,
  formatCardNumber,
  getCardExpectedCvvLength,
  getCardExpectedLengths,
  onlyDigits,
  passesLuhn,
  type CardBrand,
} from "@/lib/cardRules";
import { API_URL, apiFetch } from "@/lib/api";
import { trackPaymentEvent } from "@/lib/paymentTelemetry";
import Lottie from "lottie-react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PaymentMethod = "pix" | "card" | "debit_qr";
type CardData = { number: string; holder: string; expiration: string; cvv: string; installments: number };
type DebitCardData = { number: string; holder: string; expiration: string; cvv: string };
type CheckoutSummaryResponse = { id: string; status: string; total_amount: number; expires_at: string };
type PaymentResponse = { flow?: "qr" | "direct"; status?: "approved" | "rejected"; message?: string; public_token?: string; qr_code?: string; expires_at?: string; transaction_id?: string; method?: PaymentMethod };
type InstallmentPreview = { installments: number; rate: number; totalWithInterest: number; installmentValue: number };
type CheckoutStoredData = { total_amount?: number; product_name?: string; product_description?: string };
type ConfirmationState = "closed" | "processing" | "approved" | "rejected";
type DebitOverlayState = "closed" | "pending" | "approved" | "error";
type DebitQrSession = { token: string; qrCode: string; expiresAt: string; transactionId: string };
type DebitStatusPayload = { message?: string; status?: string; paid?: boolean; expires_at?: string; server_time?: string };
type CheckoutResumeState = {
  selectedMethod?: PaymentMethod;
  installmentsSelected?: boolean;
  cardData?: Omit<CardData, "cvv">;
  debitCardData?: Omit<DebitCardData, "cvv">;
};

const EMPTY_CARD_DATA: CardData = { number: "", holder: "", expiration: "", cvv: "", installments: 1 };
const EMPTY_DEBIT_DATA: DebitCardData = { number: "", holder: "", expiration: "", cvv: "" };
const CARD_BRAND_ASSET: Record<CardBrand, string> = {
  visa: "/card-brands/visa.svg", mastercard: "/card-brands/mastercard.svg", amex: "/card-brands/amex.svg", elo: "/card-brands/elo.svg",
  hipercard: "/card-brands/hipercard.svg", discover: "/card-brands/discover.svg", diners: "/card-brands/diners.svg", jcb: "/card-brands/jcb.svg",
  aura: "/card-brands/aura.svg", desconhecida: "/card-brands/desconhecida.svg"
};

const normalizeText = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const getInstallmentRate = (n: number) => (n === 1 ? 0 : n <= 6 ? 0.015 : 0.025);
const formatCurrency = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MIN_AMOUNT_FOR_INSTALLMENTS = 5000;
const getCheckoutResumeKey = (id: string) => `checkout:state:${id}`;

function formatExpiration(v: string) { const d = onlyDigits(v).slice(0, 4); return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`; }

function getCardErrors(card: { number: string; holder: string; expiration: string; cvv: string }, brand: CardBrand) {
  const errors: Partial<Record<"number" | "holder" | "expiration" | "cvv", string>> = {};
  const number = onlyDigits(card.number); const exp = onlyDigits(card.expiration); const month = Number(exp.slice(0, 2)); const year = Number(exp.slice(2, 4));
  const lengths = getCardExpectedLengths(brand); const cvvLength = getCardExpectedCvvLength(brand);
  if (!lengths.includes(number.length)) errors.number = `Numero invalido. Use ${lengths.join(" ou ")} digitos.`; else if (!passesLuhn(number)) errors.number = "Numero de cartao invalido.";
  if (card.holder.trim().length < 3) errors.holder = "Digite o nome do titular.";
  if (exp.length !== 4 || Number.isNaN(month) || month < 1 || month > 12) errors.expiration = "Validade invalida. Formato MM/AA.";
  else { const now = new Date(); const cy = now.getFullYear() % 100; const cm = now.getMonth() + 1; if (year < cy || (year === cy && month < cm)) errors.expiration = "Cartao vencido."; }
  if (card.cvv.length !== cvvLength) errors.cvv = `CVV deve ter ${cvvLength} digitos.`;
  return errors;
}

function buildInstallmentPreview(baseAmount: number, installments: number): InstallmentPreview {
  const rate = getInstallmentRate(installments); const totalWithInterest = Math.round(baseAmount * (1 + rate * installments));
  return { installments, rate, totalWithInterest, installmentValue: Math.round(totalWithInterest / installments) };
}

const isPaymentApproved = (p: { message?: string; status?: string; paid?: boolean }) => p.paid === true || normalizeText(p.status || "") === "approved" || normalizeText(p.message || "").includes("pagamento ja confirmado");

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const amountFromQuery = searchParams.get("amount");
  const parsedAmountFromQuery = amountFromQuery && /^\d+$/.test(amountFromQuery) ? Number(amountFromQuery) : null;

  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [cardData, setCardData] = useState<CardData>(EMPTY_CARD_DATA);
  const [installmentsSelected, setInstallmentsSelected] = useState(false);
  const [debitCardData, setDebitCardData] = useState<DebitCardData>(EMPTY_DEBIT_DATA);
  const [touched, setTouched] = useState<Partial<Record<keyof CardData, boolean>>>({});
  const [debitTouched, setDebitTouched] = useState<Partial<Record<keyof DebitCardData, boolean>>>({});
  const [cardBrand, setCardBrand] = useState<CardBrand>("desconhecida");
  const [debitCardBrand, setDebitCardBrand] = useState<CardBrand>("desconhecida");
  const [orderSummary, setOrderSummary] = useState<CheckoutSummaryResponse | null>(null);
  const [fallbackAmount, setFallbackAmount] = useState<number | null>(parsedAmountFromQuery);
  const [storedData, setStoredData] = useState<CheckoutStoredData | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>("closed");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [debitOverlayState, setDebitOverlayState] = useState<DebitOverlayState>("closed");
  const [debitOverlayMessage, setDebitOverlayMessage] = useState("");
  const [debitQrSession, setDebitQrSession] = useState<DebitQrSession | null>(null);
  const [debitTimeLeft, setDebitTimeLeft] = useState<number | null>(null);
  const [debitPollingDelay, setDebitPollingDelay] = useState(2000);
  const [resumedStateNotice, setResumedStateNotice] = useState(false);
  const cardModalRef = useRef<HTMLDivElement | null>(null);
  const debitModalRef = useRef<HTMLDivElement | null>(null);
  const expiredLoggedRef = useRef(false);

  const clearCardSensitiveData = useCallback(() => {
    setCardData(EMPTY_CARD_DATA);
    setCardBrand("desconhecida");
    setTouched({});
  }, []);

  const clearDebitSensitiveData = useCallback(() => {
    setDebitCardData(EMPTY_DEBIT_DATA);
    setDebitCardBrand("desconhecida");
    setDebitTouched({});
  }, []);

  const closeDebitOverlay = useCallback(() => {
    setDebitOverlayState("closed");
    setDebitQrSession(null);
    setDebitTimeLeft(null);
    setDebitOverlayMessage("");
    setDebitPollingDelay(2000);
    clearDebitSensitiveData();
  }, [clearDebitSensitiveData]);

  const closeCardOverlay = useCallback(() => {
    setConfirmationState("closed");
    setConfirmationMessage("");
    clearCardSensitiveData();
  }, [clearCardSensitiveData]);

  useEffect(() => {
    if (!orderId) return;
    const raw = sessionStorage.getItem(`checkout:${orderId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as CheckoutStoredData;
      setStoredData(parsed);
      if (typeof parsed.total_amount === "number" && parsed.total_amount >= 0) setFallbackAmount(parsed.total_amount);
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const raw = sessionStorage.getItem(getCheckoutResumeKey(orderId));
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CheckoutResumeState;
      if (parsed.selectedMethod) setSelectedMethod(parsed.selectedMethod);
      if (typeof parsed.installmentsSelected === "boolean") setInstallmentsSelected(parsed.installmentsSelected);
      if (parsed.cardData) {
        setCardData((prev) => ({
          ...prev,
          number: parsed.cardData?.number ?? prev.number,
          holder: parsed.cardData?.holder ?? prev.holder,
          expiration: parsed.cardData?.expiration ?? prev.expiration,
          installments: parsed.cardData?.installments ?? prev.installments,
        }));
      }
      if (parsed.debitCardData) {
        setDebitCardData((prev) => ({
          ...prev,
          number: parsed.debitCardData?.number ?? prev.number,
          holder: parsed.debitCardData?.holder ?? prev.holder,
          expiration: parsed.debitCardData?.expiration ?? prev.expiration,
        }));
      }
      setResumedStateNotice(true);
      setTimeout(() => setResumedStateNotice(false), 2800);
    } catch {
      // ignore invalid persisted state
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setLoadingSummary(false); setSummaryError("Pedido inválido."); return; }
    let active = true;
    const load = async () => {
      setLoadingSummary(true); setSummaryError("");
      try {
        const summary = (await apiFetch(`/orders/${orderId}/checkout-summary`)) as CheckoutSummaryResponse;
        if (active) setOrderSummary(summary);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Não foi possivel carregar o resumo do pedido.";
        if (active) setSummaryError(parsedAmountFromQuery !== null || fallbackAmount !== null ? "" : message);
      } finally { if (active) setLoadingSummary(false); }
    };
    load();
    return () => { active = false; };
  }, [orderId, parsedAmountFromQuery, fallbackAmount]);

  const checkDebitStatusNow = useCallback(async () => {
    if (!debitQrSession?.token) return;
    const res = await fetch(`${API_URL}/orders/debit/${debitQrSession.token}`);
    const payload = (await res.json()) as DebitStatusPayload;

    if (isPaymentApproved(payload)) {
      setDebitOverlayState("approved");
      setDebitOverlayMessage("Pagamento confirmado com sucesso.");
      setDebitPollingDelay(2000);
      trackPaymentEvent("confirmed", { method: "debit_qr", token: debitQrSession?.token });
      return;
    }

    const msg = normalizeText(payload.message || "");
    if (msg.includes("expirado") || msg.includes("cancelado")) {
      setDebitOverlayState("error");
      setDebitOverlayMessage(payload.message || "Pagamento expirado.");
      if (!expiredLoggedRef.current) {
        expiredLoggedRef.current = true;
        trackPaymentEvent("expired", { method: "debit_qr", token: debitQrSession?.token, message: payload.message });
      }
      return;
    }

    if (payload.expires_at && payload.server_time) {
      const expires = new Date(payload.expires_at).getTime();
      const now = new Date(payload.server_time).getTime();
      setDebitTimeLeft(Math.max(Math.floor((expires - now) / 1000), 0));
    }

    setDebitPollingDelay(2000);
  }, [debitQrSession?.token]);

  useEffect(() => {
    if (debitOverlayState !== "pending" || !debitQrSession?.token) return;

    let cancelled = false;
    const run = async () => {
      try {
        await checkDebitStatusNow();
      } catch {
        if (!cancelled) {
          setDebitPollingDelay((prev) => Math.min(prev + 2000, 10000));
        }
      }
      if (!cancelled) {
        setTimeout(run, debitPollingDelay);
      }
    };

    const timer = setTimeout(run, debitPollingDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [debitOverlayState, debitQrSession?.token, debitPollingDelay, checkDebitStatusNow]);

  useEffect(() => {
    if (debitTimeLeft === null || debitTimeLeft <= 0 || debitOverlayState !== "pending") return;
    const timer = setInterval(() => setDebitTimeLeft((prev) => (prev && prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [debitTimeLeft, debitOverlayState]);

  useEffect(() => {
    if (debitOverlayState === "pending" && debitTimeLeft === 0) {
      setDebitOverlayState("error"); setDebitOverlayMessage("QR Code expirado. Gere um novo para continuar.");
      if (!expiredLoggedRef.current) {
        expiredLoggedRef.current = true;
        trackPaymentEvent("expired", { method: "debit_qr", token: debitQrSession?.token, reason: "timer_zero" });
      }
    }
  }, [debitOverlayState, debitTimeLeft, debitQrSession?.token]);

  useEffect(() => {
    if (confirmationState !== "closed") {
      cardModalRef.current?.focus();
    }
  }, [confirmationState]);

  useEffect(() => {
    if (debitOverlayState !== "closed") {
      debitModalRef.current?.focus();
    }
  }, [debitOverlayState]);

  useEffect(() => {
    const hasModalOpen = confirmationState !== "closed" || debitOverlayState !== "closed";
    if (!hasModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCardOverlay();
      closeDebitOverlay();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmationState, debitOverlayState, closeCardOverlay, closeDebitOverlay]);

  useEffect(() => {
    if (!orderId) return;
    const payload: CheckoutResumeState = {
      selectedMethod,
      installmentsSelected,
      cardData: {
        number: cardData.number,
        holder: cardData.holder,
        expiration: cardData.expiration,
        installments: cardData.installments,
      },
      debitCardData: {
        number: debitCardData.number,
        holder: debitCardData.holder,
        expiration: debitCardData.expiration,
      },
    };
    sessionStorage.setItem(getCheckoutResumeKey(orderId), JSON.stringify(payload));
  }, [orderId, selectedMethod, installmentsSelected, cardData, debitCardData]);

  const baseAmount = orderSummary?.total_amount ?? fallbackAmount ?? 0;
  const maxInstallmentsAllowed = baseAmount >= MIN_AMOUNT_FOR_INSTALLMENTS ? 12 : 1;
  const canSplitInstallments = maxInstallmentsAllowed > 1;
  useEffect(() => {
    if (cardData.installments > maxInstallmentsAllowed) {
      setCardData((prev) => ({ ...prev, installments: 1 }));
    }
  }, [cardData.installments, maxInstallmentsAllowed]);

  const selectedInstallmentPreview = useMemo(() => buildInstallmentPreview(baseAmount, cardData.installments), [baseAmount, cardData.installments]);
  const installmentOptions = useMemo(
    () => Array.from({ length: maxInstallmentsAllowed }, (_, i) => buildInstallmentPreview(baseAmount, i + 1)),
    [baseAmount, maxInstallmentsAllowed],
  );
  const additionalInstallmentCost = Math.max(selectedInstallmentPreview.totalWithInterest - baseAmount, 0);

  const cardErrors = getCardErrors(cardData, cardBrand);
  const debitErrors = getCardErrors({ ...debitCardData }, debitCardBrand);
  const isCardValid = Object.keys(cardErrors).length === 0;
  const isDebitValid = Object.keys(debitErrors).length === 0;
  const debitStep = debitOverlayState === "approved" ? 4 : debitOverlayState === "pending" ? 3 : debitQrSession ? 2 : 1;
  const politeLiveMessage =
    confirmationState === "processing"
      ? "Processando pagamento."
      : debitOverlayState === "pending"
        ? "QR Code de débito gerado. Aguardando confirmação no celular."
        : "";
  const assertiveLiveMessage =
    confirmationState === "approved" || debitOverlayState === "approved"
      ? "Pagamento aprovado."
      : confirmationState === "rejected" || debitOverlayState === "error"
        ? "Pagamento com erro."
        : "";

  const formatTime = (s: number) => `${Math.floor(Math.max(s, 0) / 60)}:${String(Math.max(s, 0) % 60).padStart(2, "0")}`;

  const handlePayment = async () => {
    if (!orderId) { setError("Pedido inválido."); return; }
    if (selectedMethod === "debit_qr") { await handleGenerateDebitQr(); return; }
    if (selectedMethod === "card" && !isCardValid) { setTouched({ number: true, holder: true, expiration: true, cvv: true, installments: true }); return; }

    setLoading(true); setError(""); setConfirmationMessage(""); if (selectedMethod === "card") setConfirmationState("processing");
    try {
      const body: { method: PaymentMethod; card?: CardData } = { method: selectedMethod };
      if (selectedMethod === "card") body.card = { ...cardData, number: onlyDigits(cardData.number), expiration: formatExpiration(cardData.expiration) };

      const response = (await apiFetch(`/orders/${orderId}/pay`, { method: "POST", body: JSON.stringify(body) })) as PaymentResponse;
      if (response.flow === "qr") { router.push(`/pix/${response.public_token}`); return; }
      if (response.flow === "direct") {
        if (response.status === "approved") {
          setConfirmationState("approved");
          setConfirmationMessage("Pagamento confirmado com sucesso.");
          trackPaymentEvent("confirmed", { method: "card" });
        }
        else {
          const failMessage = response.message || "Pagamento recusado.";
          setConfirmationState("rejected");
          setConfirmationMessage(failMessage);
          setError(failMessage);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar pagamento.";
      setError(message); if (selectedMethod === "card") { setConfirmationState("rejected"); setConfirmationMessage(message); }
    } finally { setLoading(false); }
  };

  const handleGenerateDebitQr = async () => {
    if (!orderId) { setError("Pedido inválido."); return; }
    if (!isDebitValid) { setDebitTouched({ number: true, holder: true, expiration: true, cvv: true }); return; }
    setLoading(true); setError("");
    try {
      const response = (await apiFetch(`/orders/${orderId}/pay`, {
        method: "POST",
        body: JSON.stringify({ method: "debit_qr", card: { ...debitCardData, number: onlyDigits(debitCardData.number), expiration: formatExpiration(debitCardData.expiration) } }),
      })) as PaymentResponse;

      if (response.method && response.method !== "debit_qr") {
        throw new Error("Resposta inesperada para pagamento no débito.");
      }
      if (response.flow !== "qr" || !response.public_token || !response.qr_code || !response.expires_at) throw new Error("Não foi possível gerar o QR Code de débito.");
      setDebitQrSession({ token: response.public_token, qrCode: response.qr_code, expiresAt: response.expires_at, transactionId: response.transaction_id || "" });
      setDebitTimeLeft(Math.max(Math.floor((new Date(response.expires_at).getTime() - Date.now()) / 1000), 0));
      setDebitOverlayState("pending");
      setDebitPollingDelay(2000);
      expiredLoggedRef.current = false;
      trackPaymentEvent("generated_qr", {
        method: "debit_qr",
        token: response.public_token,
        brand: debitCardBrand,
        last4: onlyDigits(debitCardData.number).slice(-4),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao gerar QR Code de débito.";
      setDebitOverlayState("error"); setDebitOverlayMessage(message); setError(message);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <PaymentLayout
        title="Escolha o método de pagamento"
        subtitle="Seus dados são protegidos e processados em ambiente seguro."
      >
        <div aria-live="polite" className="sr-only">{politeLiveMessage}</div>
        <div aria-live="assertive" className="sr-only">{assertiveLiveMessage}</div>
        {resumedStateNotice && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status" aria-live="polite">
            Sessão retomada após atualização da página.
          </div>
        )}

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
          {loadingSummary ? <p className="text-sm text-neutral-400">Carregando valores do pedido...</p> : (
            <div className="space-y-2 text-sm">
              {summaryError && baseAmount === 0 && <p className="text-sm text-red-300">{summaryError}</p>}
              <div className="flex items-center justify-between text-neutral-300"><span>Valor original</span><span>{formatCurrency(baseAmount)}</span></div>
              {selectedMethod === "card" && <>
                <div className="flex items-center justify-between text-neutral-300"><span>Taxa de parcelamento</span><span>{(selectedInstallmentPreview.rate * 100).toFixed(2)}% ao mes</span></div>
                <div className="flex items-center justify-between font-semibold text-white"><span>Total no cartao</span><span>{formatCurrency(selectedInstallmentPreview.totalWithInterest)}</span></div>
                <div className="text-xs text-neutral-400">{selectedInstallmentPreview.installments}x de {formatCurrency(selectedInstallmentPreview.installmentValue)}</div>
                {installmentsSelected && additionalInstallmentCost > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    Custo do parcelamento: +{formatCurrency(additionalInstallmentCost)}
                  </div>
                )}
              </>}
              {selectedMethod === "debit_qr" && <>
                <div className="flex items-center justify-between text-neutral-300"><span>Taxa de débito</span><span>0,00%</span></div>
                <div className="flex items-center justify-between font-semibold text-white"><span>Total no débito</span><span>{formatCurrency(baseAmount)}</span></div>
              </>}
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => setSelectedMethod("pix")} className={`rounded-xl border p-4 text-left transition ${selectedMethod === "pix" ? "border-emerald-400 bg-emerald-500/10" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}><p className="text-sm font-semibold">PIX</p><p className="mt-1 text-xs text-neutral-400">Pagamento rápido por QR Code.</p></button>
          <button onClick={() => setSelectedMethod("card")} className={`rounded-xl border p-4 text-left transition ${selectedMethod === "card" ? "border-emerald-400 bg-emerald-500/10" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}><p className="text-sm font-semibold">Cartão de crédito</p><p className="mt-1 text-xs text-neutral-400">Pague em até 12 parcelas.</p></button>
          <button onClick={() => setSelectedMethod("debit_qr")} className={`rounded-xl border p-4 text-left transition ${selectedMethod === "debit_qr" ? "border-emerald-400 bg-emerald-500/10" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}><p className="text-sm font-semibold">Cartão de débito</p><p className="mt-1 text-xs text-neutral-400">Gerar QR Code para confirmar no celular.</p></button>
        </div>

        {selectedMethod !== "pix" && (
          <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            {selectedMethod === "debit_qr" && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-400">Etapas do débito</p>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-neutral-400">
                  {[
                    "Dados",
                    "Gerar QR",
                    "Confirmar no celular",
                    "Concluido",
                  ].map((label, index) => {
                    const stepNumber = index + 1;
                    const active = stepNumber <= debitStep;
                    return (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            active
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                              : "border-neutral-700 text-neutral-500"
                          }`}
                        >
                          {stepNumber}
                        </div>
                        <span className={active ? "text-emerald-300" : "text-neutral-500"}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label htmlFor="card-number" className="block text-sm text-neutral-300">{selectedMethod === "card" ? "Numero do cartao" : "Numero do cartao de debito"}</label>
                <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${(selectedMethod === "card" ? cardBrand : debitCardBrand) === "desconhecida" ? "border-neutral-700 text-neutral-400" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"}`}>
                  <span className="flex items-center gap-2">
                    <Image src={CARD_BRAND_ASSET[selectedMethod === "card" ? cardBrand : debitCardBrand]} alt={cardBrandLabel(selectedMethod === "card" ? cardBrand : debitCardBrand)} width={24} height={16} className="h-4 w-auto" />
                    {cardBrandLabel(selectedMethod === "card" ? cardBrand : debitCardBrand)}
                  </span>
                </span>
              </div>
              <input id="card-number" inputMode="numeric" autoComplete="cc-number"
                placeholder={(selectedMethod === "card" ? cardBrand : debitCardBrand) === "amex" ? "0000 000000 00000" : "0000 0000 0000 0000"}
                value={selectedMethod === "card" ? cardData.number : debitCardData.number}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none transition focus:border-emerald-400"
                onBlur={() => selectedMethod === "card" ? setTouched((p) => ({ ...p, number: true })) : setDebitTouched((p) => ({ ...p, number: true }))}
                onChange={(e) => {
                  const detected = detectCardBrand(e.target.value); const formatted = formatCardNumber(e.target.value, detected);
                  if (selectedMethod === "card") { setCardBrand(detected); setCardData((p) => ({ ...p, number: formatted })); }
                  else { setDebitCardBrand(detected); setDebitCardData((p) => ({ ...p, number: formatted })); }
                }} />
              {selectedMethod === "card" && touched.number && cardErrors.number && <p className="mt-1 text-xs text-red-400">{cardErrors.number}</p>}
              {selectedMethod === "debit_qr" && debitTouched.number && debitErrors.number && <p className="mt-1 text-xs text-red-400">{debitErrors.number}</p>}
            </div>

            <div>
              <label htmlFor="card-holder" className="mb-1 block text-sm text-neutral-300">Nome do titular</label>
              <input id="card-holder" autoComplete="cc-name" placeholder="Nome como no cartao"
                value={selectedMethod === "card" ? cardData.holder : debitCardData.holder}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none transition focus:border-emerald-400"
                onBlur={() => selectedMethod === "card" ? setTouched((p) => ({ ...p, holder: true })) : setDebitTouched((p) => ({ ...p, holder: true }))}
                onChange={(e) => selectedMethod === "card" ? setCardData((p) => ({ ...p, holder: e.target.value })) : setDebitCardData((p) => ({ ...p, holder: e.target.value }))} />
              {selectedMethod === "card" && touched.holder && cardErrors.holder && <p className="mt-1 text-xs text-red-400">{cardErrors.holder}</p>}
              {selectedMethod === "debit_qr" && debitTouched.holder && debitErrors.holder && <p className="mt-1 text-xs text-red-400">{debitErrors.holder}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-expiration" className="mb-1 block text-sm text-neutral-300">Validade</label>
                <input id="card-expiration" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
                  value={selectedMethod === "card" ? cardData.expiration : debitCardData.expiration}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none transition focus:border-emerald-400"
                  onBlur={() => selectedMethod === "card" ? setTouched((p) => ({ ...p, expiration: true })) : setDebitTouched((p) => ({ ...p, expiration: true }))}
                  onChange={(e) => selectedMethod === "card" ? setCardData((p) => ({ ...p, expiration: formatExpiration(e.target.value) })) : setDebitCardData((p) => ({ ...p, expiration: formatExpiration(e.target.value) }))} />
                {selectedMethod === "card" && touched.expiration && cardErrors.expiration && <p className="mt-1 text-xs text-red-400">{cardErrors.expiration}</p>}
                {selectedMethod === "debit_qr" && debitTouched.expiration && debitErrors.expiration && <p className="mt-1 text-xs text-red-400">{debitErrors.expiration}</p>}
              </div>
              <div>
                <label htmlFor="card-cvv" className="mb-1 block text-sm text-neutral-300">CVV</label>
                <input id="card-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder={(selectedMethod === "card" ? cardBrand : debitCardBrand) === "amex" ? "0000" : "000"}
                  value={selectedMethod === "card" ? cardData.cvv : debitCardData.cvv}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none transition focus:border-emerald-400"
                  onBlur={() => selectedMethod === "card" ? setTouched((p) => ({ ...p, cvv: true })) : setDebitTouched((p) => ({ ...p, cvv: true }))}
                  onChange={(e) => {
                    const expected = getCardExpectedCvvLength(selectedMethod === "card" ? cardBrand : debitCardBrand);
                    if (selectedMethod === "card") setCardData((p) => ({ ...p, cvv: onlyDigits(e.target.value).slice(0, expected) }));
                    else setDebitCardData((p) => ({ ...p, cvv: onlyDigits(e.target.value).slice(0, expected) }));
                  }} />
                {selectedMethod === "card" && touched.cvv && cardErrors.cvv && <p className="mt-1 text-xs text-red-400">{cardErrors.cvv}</p>}
                {selectedMethod === "debit_qr" && debitTouched.cvv && debitErrors.cvv && <p className="mt-1 text-xs text-red-400">{debitErrors.cvv}</p>}
              </div>
            </div>

            {selectedMethod === "card" && (
              <div>
                <label htmlFor="installments" className="mb-1 block text-sm text-neutral-300">Parcelas</label>
                <select
                  id="installments"
                  value={cardData.installments}
                  disabled={!canSplitInstallments}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(e) => {
                    setInstallmentsSelected(true);
                    setCardData((p) => ({ ...p, installments: Number(e.target.value) }));
                  }}
                >
                  {installmentOptions.map((o) => <option key={o.installments} value={o.installments}>{o.installments}x de {formatCurrency(o.installmentValue)} (total {formatCurrency(o.totalWithInterest)})</option>)}
                </select>
                {!canSplitInstallments && (
                  <p className="mt-1 text-xs text-amber-300">
                    Parcelamento disponivel apenas para pedidos a partir de {formatCurrency(MIN_AMOUNT_FOR_INSTALLMENTS)}.
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-500">
                  Regra de bandeira: {cardBrandLabel(cardBrand)} - {CARD_RULES[cardBrand].lengths.join("/")} digitos, CVV {CARD_RULES[cardBrand].cvvLength}.
                </p>
              </div>
            )}
          </div>
        )}

        {error && <div className="mb-4 rounded-lg border border-red-600/60 bg-red-950/70 p-3 text-sm text-red-200" role="alert" aria-live="assertive">{error}</div>}

        {selectedMethod === "debit_qr" ? (
          <button onClick={handleGenerateDebitQr} disabled={loading || loadingSummary} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400">{loading ? "Gerando QR Code..." : "Gerar QR code de confirmação"}</button>
        ) : (
          <button onClick={handlePayment} disabled={(selectedMethod === "card" && !isCardValid) || loadingSummary || loading} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400">{loading ? "Processando pagamento..." : "Confirmar pagamento"}</button>
        )}
      </PaymentLayout>
      {confirmationState !== "closed" && selectedMethod === "card" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            ref={cardModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Status do pagamento com cartao"
            className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl outline-none"
          >
            {confirmationState === "processing" && <><h2 className="text-2xl font-bold">Confirmando pagamento...</h2><div className="mt-4 h-2 w-full rounded bg-neutral-800"><div className="h-full w-1/2 animate-pulse bg-emerald-400" /></div></>}
            {confirmationState === "approved" && <><div className="mx-auto mb-3 w-32.5"><Lottie animationData={successAnimation} loop={false} /></div><h2 className="text-center text-2xl font-bold">Pagamento confirmado</h2></>}
            {confirmationState === "rejected" && <><h2 className="text-2xl font-bold text-red-300">Pagamento recusado</h2><p className="mt-2 text-sm text-red-200">{confirmationMessage}</p></>}
            {confirmationState !== "processing" && (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <p className="text-sm font-semibold text-white">{storedData?.product_name ?? "Produto selecionado"}</p>
                <div className="mt-2 text-sm text-neutral-300">Valor original: {formatCurrency(baseAmount)}</div>
                <div className="text-sm text-neutral-300">Parcelas: {selectedInstallmentPreview.installments}x</div>
                <div className="text-sm font-semibold text-white">Total: {formatCurrency(selectedInstallmentPreview.totalWithInterest)}</div>
              </div>
            )}
            {confirmationState !== "processing" && <div className="mt-5 flex gap-3"><button onClick={() => { clearCardSensitiveData(); router.push("/"); }} className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black">Ir para inicio</button><button onClick={closeCardOverlay} className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 font-semibold">Fechar</button></div>}
          </div>
        </div>
      )}

      {debitOverlayState !== "closed" && debitQrSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            ref={debitModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Status do pagamento no debito"
            className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl outline-none"
          >
            {debitOverlayState === "pending" && (
              <>
                <h2 className="text-2xl font-bold">Escaneie para confirmar no celular</h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={debitQrSession.qrCode} alt="QR Code debito" className="mx-auto my-5 w-full max-w-65 rounded-xl border border-neutral-700 bg-white p-3" />
                <div className="rounded-lg border border-amber-500/30 bg-amber-400/10 p-2 text-center text-sm text-amber-200">{debitTimeLeft !== null ? `Expira em ${formatTime(debitTimeLeft)}` : "Aguardando confirmação..."}</div>
              </>
            )}
            {debitOverlayState === "approved" && <><div className="mx-auto mb-3 w-32.5"><Lottie animationData={successAnimation} loop={false} /></div><h2 className="text-center text-2xl font-bold">Pagamento confirmado</h2></>}
            {debitOverlayState === "error" && <><h2 className="text-2xl font-bold text-red-300">Confirmação indisponível</h2><p className="mt-2 text-sm text-red-200">{debitOverlayMessage}</p></>}

            {debitOverlayState !== "pending" && (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <p className="text-sm font-semibold text-white">{storedData?.product_name ?? "Produto selecionado"}</p>
                <div className="mt-2 text-sm text-neutral-300">Valor: {formatCurrency(baseAmount)}</div>
                <div className="text-sm text-neutral-300">Taxa: 0,00%</div>
                <div className="text-sm font-semibold text-white">Total no débito: {formatCurrency(baseAmount)}</div>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              {debitOverlayState === "approved" && <button onClick={() => { clearDebitSensitiveData(); router.push("/"); }} className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black">Ir para inicio</button>}
              {debitOverlayState === "error" && <button onClick={handleGenerateDebitQr} className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black">Gerar novo QR</button>}
              <button onClick={closeDebitOverlay} className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 font-semibold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
