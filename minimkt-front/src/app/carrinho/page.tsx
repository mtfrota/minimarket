"use client";

import { apiFetch } from "@/lib/api";
import { clearCart, getCartItems, getCartTotal, removeFromCart, toOrderItemsPayload, updateCartItemQuantity } from "@/lib/cart";
import { CartItem } from "@/types/cart";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CreateOrderResponse = {
  id: string;
  total_amount: number;
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CarrinhoPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState("");
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const total = useMemo(() => items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0), [items]);

  function syncItems() {
    setItems(getCartItems());
  }

  useEffect(() => {
    syncItems();
    const handleUpdate = () => syncItems();
    window.addEventListener("cart:updated", handleUpdate);
    return () => window.removeEventListener("cart:updated", handleUpdate);
  }, []);

  async function handleCheckout() {
    setError("");

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      router.push("/login");
      return;
    }

    if (items.length === 0) {
      setError("Seu carrinho está vazio");
      return;
    }

    setLoadingCheckout(true);

    try {
      const order = (await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: toOrderItemsPayload(items),
        }),
      })) as CreateOrderResponse;

      sessionStorage.setItem(
        `checkout:${order.id}`,
        JSON.stringify({
          total_amount: order.total_amount,
          product_name: items.length === 1 ? items[0].title : `${items.length} produtos`,
          product_description: items.length === 1 ? items[0].description : "Itens do carrinho",
        }),
      );

      clearCart();
      router.push(`/checkout/${order.id}?amount=${order.total_amount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar pedido";
      setError(message);
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 backdrop-blur">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Carrinho</h1>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
          >
            Limpar carrinho
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-6 text-center">
          <p className="text-neutral-300">Seu carrinho está vazio.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900">
            Ver produtos
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.productId} className="rounded-xl border border-white/10 bg-neutral-950/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                    <p className="mt-1 text-xs text-neutral-400">{item.description}</p>
                    <p className="mt-2 text-sm text-emerald-300">{formatMoney(item.unitPrice)}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-xs text-red-300 transition hover:text-red-200"
                  >
                    Remover
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                    className="h-8 w-8 rounded-md border border-white/10"
                  >
                    -
                  </button>
                  <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                    className="h-8 w-8 rounded-md border border-white/10"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-neutral-950/40 p-4">
            <div className="flex items-center justify-between text-sm text-neutral-300">
              <span>Subtotal</span>
              <span>{formatMoney(getCartTotal())}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-white">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <button
              onClick={handleCheckout}
              disabled={loadingCheckout}
              className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-neutral-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingCheckout ? "Confirmando pedido..." : "Confirmar pedido"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
