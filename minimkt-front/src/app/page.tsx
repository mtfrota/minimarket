"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types/product";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/products")
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  const highlightedProducts = useMemo(() => products.slice(0, 3), [products]);

  return (
    <div className="space-y-12 p-6 sm:p-8 lg:p-10">
      <section className="scroll-mt-28 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-neutral-900 to-neutral-950 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">MiniMarket</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Compras rapidas para o seu dia</h1>
        <p className="mt-3 max-w-xl text-sm text-neutral-300">
          Explore produtos, aproveite ofertas e finalize pagamentos com seguranca em poucos passos.
        </p>
      </section>

      <section id="produtos" className="scroll-mt-28">
        <h2 className="mb-4 text-2xl font-bold text-white">Produtos</h2>
        {error && <p className="mb-4 text-red-400">Erro: {error}</p>}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section id="ofertas" className="scroll-mt-28 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Ofertas</h2>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">Atualizado hoje</span>
        </div>
        {highlightedProducts.length === 0 ? (
          <p className="text-sm text-neutral-400">Sem ofertas no momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {highlightedProducts.map((product) => (
              <article key={product.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm font-semibold text-white">{product.title}</p>
                <p className="mt-1 text-xs text-neutral-300">{product.description}</p>
                <p className="mt-3 text-sm font-bold text-emerald-300">R$ {(product.price / 100).toFixed(2)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="contato" className="scroll-mt-28 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">Contato</h2>
        <p className="mt-3 text-sm text-neutral-300">Fale com nosso time para suporte, duvidas sobre pedidos e parceria comercial.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Email</p>
            <p className="mt-1 text-sm text-white">suporte@minimarket.com</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-neutral-400">WhatsApp</p>
            <p className="mt-1 text-sm text-white">+55 (11) 90000-0000</p>
          </div>
        </div>
      </section>
    </div>
  );
}
