"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type PaymentHistoryItem = {
  id: string;
  transaction_id: string;
  method: "pix" | "card" | "debit_qr";
  status: "pending" | "approved" | "rejected";
  amount: number;
  created_at: string;
  processed_at: string | null;
  order_id: string;
  product_name?: string;
  product_description?: string;
};

type PeriodFilter = "all" | "7d" | "30d" | "90d";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const PAGE_SIZE = 8;

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: string | null) {
  if (!date) return "-";
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

export default function HistoricoComprasPage() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageTransition, setPageTransition] = useState(false);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch("/orders/payments/my-history")
      .then((data) => setItems(data as PaymentHistoryItem[]))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Erro ao carregar historico";
        setError(message);
      });
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (!isWithinPeriod(item.created_at, periodFilter)) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q) {
        const hay = `${item.order_id} ${item.transaction_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, periodFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  function changePage(nextPage: number) {
    if (nextPage === page) return;
    setPageTransition(true);
    setPage(nextPage);
    setTimeout(() => setPageTransition(false), 180);
  }

  function handleExportCsv() {
    const headers = ["pedido_id", "transacao_id", "metodo", "status", "valor", "criado_em", "nome", "descricao"];
    const rows = filteredItems.map((item) => [
      item.order_id,
      item.transaction_id,
      item.method,
      item.status,
      item.amount / 100,
      item.created_at,
      item.product_name || "",
      item.product_description || "",
    ]);
    downloadCsv("historico-compras.csv", headers, rows);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Historico de compras</h1>
          <p className="mt-2 text-sm text-neutral-400">Lista completa das transacoes do comprador.</p>
        </div>

        <button onClick={handleExportCsv} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/5">
          Exportar CSV
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 md:grid-cols-3">
        <label className="text-sm text-neutral-300">
          Periodo
          <select
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value as PeriodFilter);
              setPage(1);
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
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Buscar por ID pedido/transacao
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
            placeholder="Ex.: ORD-123 ou TX-123"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 rounded-xl border border-white/10 bg-neutral-950/40 p-4">
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold text-white">Registros ({filteredItems.length})</h2>
          <Chevron open={historyOpen} />
        </button>

        {historyOpen && (
          <>
            <div className={`mt-4 overflow-x-auto rounded-xl border border-white/10 transition-all duration-200 ${pageTransition ? "translate-y-1 opacity-70" : "translate-y-0 opacity-100"}`}>
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-950/70 text-neutral-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Pedido</th>
                    <th className="px-3 py-2 text-left">Nome do pedido</th>
                    <th className="px-3 py-2 text-left">Descricao</th>
                    <th className="px-3 py-2 text-left">Transacao</th>
                    <th className="px-3 py-2 text-left">Metodo</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Valor</th>
                    <th className="px-3 py-2 text-left">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-neutral-500" colSpan={8}>
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                  {pageItems.map((item) => (
                    <tr key={item.id} className="border-t border-white/5 text-neutral-200 align-top">
                      <td className="px-3 py-2">{item.order_id}</td>
                      <td className="px-3 py-2">{item.product_name || "-"}</td>
                      <td className="px-3 py-2 text-neutral-300">{item.product_description || "-"}</td>
                      <td className="px-3 py-2">{item.transaction_id}</td>
                      <td className="px-3 py-2">{item.method}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">{formatMoney(item.amount)}</td>
                      <td className="px-3 py-2">{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredItems.length > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Anterior</button>
                <span className="text-neutral-400">{page}/{totalPages}</span>
                <button type="button" onClick={() => changePage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Proxima</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
