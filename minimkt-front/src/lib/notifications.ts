export type SystemNotification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const NOTIFICATIONS_STORAGE_KEY = "minimkt:notifications:v1";

const MESSAGES = [
  "Lembrete: revise o estoque dos produtos mais vendidos.",
  "Dica: adicionar mais fotos costuma aumentar conversao.",
  "Atualizacao: seu painel recebeu novos dados de vendas.",
  "Aviso: alguns clientes abandonaram carrinho nas ultimas horas.",
  "Lembrete: mantenha precos competitivos para destaque nas buscas.",
  "Dica: categorias bem organizadas melhoram a navegacao.",
];

export function readStoredNotifications(): SystemNotification[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SystemNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: SystemNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
}

export function createRandomNotification(): SystemNotification {
  const randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  return {
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    message: randomMessage,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function randomDelayMs() {
  const min = 25_000;
  const max = 75_000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
