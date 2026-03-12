export type PaymentEventName = "generated_qr" | "opened_mobile" | "confirmed" | "expired";

type PaymentEvent = {
  name: PaymentEventName;
  timestamp: string;
  payload?: Record<string, unknown>;
};

const STORAGE_KEY = "payment_debug_events";
const MAX_EVENTS = 100;

export function trackPaymentEvent(name: PaymentEventName, payload?: Record<string, unknown>) {
  const event: PaymentEvent = {
    name,
    timestamp: new Date().toISOString(),
    payload,
  };

  console.info(`[payment-event] ${name}`, payload ?? {});

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as PaymentEvent[]) : [];
    const next = [...current, event].slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nao interrompe fluxo de pagamento por erro de log.
  }
}
