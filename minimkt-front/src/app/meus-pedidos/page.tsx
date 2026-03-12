"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type OrderItem = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  total_amount: number;
  expires_at: string;
  product_name?: string;
  product_description?: string;
};

const PAGE_SIZE = 5;

type PeriodFilter = "all" | "7d" | "30d" | "90d";
type StatusFilter = "all" | "pending" | "paid" | "cancelled";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("pt-BR");
}

function isWithinPeriod(isoDate: string, period: PeriodFilter) {
  if (period === "all") return true;
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  const diffDays = (now - target) / (1000 * 60 * 60 * 24);
  if (period === "7d") return diffDays <= 7;
  if (period === "30d") return diffDays <= 30;
  return diffDays <= 90;
}

function toCsvValue(value: string | number | null | undefined) {
  const safe = value === null || value === undefined ? "" : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [headers.map(toCsvValue).join(","), ...rows.map((row) => row.map(toCsvValue).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

function paginate<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function SectionPagination({ page, setPage, totalItems }: { page: number; setPage: (value: number) => void; totalItems: number }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
      <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Anterior</button>
      <span className="text-neutral-400">{page}/{totalPages}</span>
      <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Proxima</button>
    </div>
  );
}

export default function MeusPedidosPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [error, setError] = useState("");
  const [pendingOpen, setPendingOpen] = useState(true);
  const [paidOpen, setPaidOpen] = useState(true);
  const [pendingPage, setPendingPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [pendingTransition, setPendingTransition] = useState(false);
  const [paidTransition, setPaidTransition] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  async function loadOrders() {
    try {
      const data = (await apiFetch("/orders/my")) as OrderItem[];
      setOrders(data);
      setError("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar pedidos";
      setError(message);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (!isWithinPeriod(order.expires_at, periodFilter)) return false;
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (q && !order.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, periodFilter, statusFilter, search]);

  const pendingOrders = useMemo(() => filteredOrders.filter((item) => item.status === "pending"), [filteredOrders]);
  const paidOrders = useMemo(() => filteredOrders.filter((item) => item.status === "paid"), [filteredOrders]);

  const pendingPageItems = useMemo(() => paginate(pendingOrders, pendingPage), [pendingOrders, pendingPage]);
  const paidPageItems = useMemo(() => paginate(paidOrders, paidPage), [paidOrders, paidPage]);

  useEffect(() => {
    setPendingTransition(true);
    const timer = setTimeout(() => setPendingTransition(false), 180);
    return () => clearTimeout(timer);
  }, [pendingPage]);

  useEffect(() => {
    setPaidTransition(true);
    const timer = setTimeout(() => setPaidTransition(false), 180);
    return () => clearTimeout(timer);
  }, [paidPage]);

  async function handleCancelPending() {
    setCancelling(true);
    setError("");

    try {
      await apiFetch("/orders/cancel-my-pending", { method: "POST" });
      setOrders((prev) => prev.filter((order) => order.status !== "pending"));
      setPendingPage(1);
      await loadOrders();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar pedidos pendentes";
      setError(message);
    } finally {
      setCancelling(false);
    }
  }

  function handleExportCsv() {
    const headers = ["pedido_id", "status", "valor", "expira_em", "nome", "descricao"];
    const rows = filteredOrders.map((order) => [
      order.id,
      order.status,
      order.total_amount / 100,
      order.expires_at,
      order.product_name || "",
      order.product_description || "",
    ]);
    downloadCsv("meus-pedidos.csv", headers, rows);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Meus pedidos</h1>
          <p className="mt-2 text-sm text-neutral-400">Acompanhe pedidos abertos e concluidos.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/5"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleCancelPending}
            disabled={cancelling || pendingOrders.length === 0}
            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? "Cancelando..." : "Cancelar pedidos pendentes"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 md:grid-cols-3">
        <label className="text-sm text-neutral-300">
          Periodo
          <select
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value as PeriodFilter);
              setPendingPage(1);
              setPaidPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="all">Todos</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPendingPage(1);
              setPaidPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Buscar por ID do pedido/transacao
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPendingPage(1);
              setPaidPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
            placeholder="Ex.: 123e4567"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-4">
          <button type="button" onClick={() => setPendingOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left">
            <h2 className="text-sm font-semibold text-white">Pendentes ({pendingOrders.length})</h2>
            <Chevron open={pendingOpen} />
          </button>

          {pendingOpen && (
            <div className={`mt-3 space-y-2 transition-all duration-200 ${pendingTransition ? "translate-y-1 opacity-70" : "translate-y-0 opacity-100"}`}>
              {pendingOrders.length === 0 && <p className="text-xs text-neutral-500">Nenhum pedido pendente.</p>}
              {pendingPageItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 p-3 text-xs text-neutral-300">
                  <p>Pedido #{item.id}</p>
                  <p>Nome: {item.product_name || "-"}</p>
                  <p>Descricao: {item.product_description || "-"}</p>
                  <p>Valor: {formatMoney(item.total_amount)}</p>
                  <p>Expira em: {formatDate(item.expires_at)}</p>
                </div>
              ))}

              {pendingOrders.length > PAGE_SIZE && <SectionPagination page={pendingPage} setPage={setPendingPage} totalItems={pendingOrders.length} />}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-950/40 p-4">
          <button type="button" onClick={() => setPaidOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left">
            <h2 className="text-sm font-semibold text-white">Pagos ({paidOrders.length})</h2>
            <Chevron open={paidOpen} />
          </button>

          {paidOpen && (
            <div className={`mt-3 space-y-2 transition-all duration-200 ${paidTransition ? "translate-y-1 opacity-70" : "translate-y-0 opacity-100"}`}>
              {paidOrders.length === 0 && <p className="text-xs text-neutral-500">Nenhum pedido pago.</p>}
              {paidPageItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 p-3 text-xs text-neutral-300">
                  <p>Pedido #{item.id}</p>
                  <p>Nome: {item.product_name || "-"}</p>
                  <p>Descricao: {item.product_description || "-"}</p>
                  <p>Valor: {formatMoney(item.total_amount)}</p>
                </div>
              ))}

              {paidOrders.length > PAGE_SIZE && <SectionPagination page={paidPage} setPage={setPaidPage} totalItems={paidOrders.length} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
