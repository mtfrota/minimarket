"use client";

import ProductCard from "@/components/ProductCard";
import { apiFetch } from "@/lib/api";
import { Product } from "@/types/product";
import { useEffect, useMemo, useState } from "react";

type SortOption = "price_asc" | "price_desc" | "best_sellers";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availability, setAvailability] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [sortBy, setSortBy] = useState<SortOption>("price_asc");

  useEffect(() => {
    apiFetch("/products")
      .then((data) => setProducts(data as Product[]))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Erro ao carregar produtos";
        setError(message);
      });
  }, []);

  const filteredProducts = useMemo(() => {
    const minCents = minPrice ? Math.round(Number(minPrice) * 100) : null;
    const maxCents = maxPrice ? Math.round(Number(maxPrice) * 100) : null;

    let list = [...products];

    list = list.filter((product) => {
      if (minCents !== null && product.price < minCents) return false;
      if (maxCents !== null && product.price > maxCents) return false;
      if (availability === "in_stock" && product.stock <= 0) return false;
      if (availability === "out_of_stock" && product.stock > 0) return false;
      return true;
    });

    if (sortBy === "price_asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    } else {
      list.sort((a, b) => a.stock - b.stock);
    }

    return list;
  }, [products, minPrice, maxPrice, availability, sortBy]);

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 backdrop-blur sm:p-8">
      <h1 className="text-2xl font-bold text-white">Produtos</h1>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 md:grid-cols-4">
        <label className="text-sm text-neutral-300">
          Preco minimo
          <input
            type="number"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
            placeholder="0.00"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Preco maximo
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
            placeholder="999.99"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Disponibilidade
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value as "all" | "in_stock" | "out_of_stock")}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="all">Todos</option>
            <option value="in_stock">Em estoque</option>
            <option value="out_of_stock">Sem estoque</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Ordenar por
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="price_asc">Preco: menor para maior</option>
            <option value="price_desc">Preco: maior para menor</option>
            <option value="best_sellers">Mais vendidos</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <p className="mt-4 text-sm text-neutral-400">{filteredProducts.length} produto(s) encontrado(s)</p>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
