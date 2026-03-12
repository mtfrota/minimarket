"use client";

import { Product } from "@/types/product";
import { addToCart } from "@/lib/cart";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  function handleAddToCart() {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      window.dispatchEvent(new Event("auth:login-required"));
      return;
    }

    addToCart({
      productId: product.id,
      title: product.title,
      description: product.description,
      unitPrice: product.price,
    });
  }

  return (
    <div className="border border-neutral-800 rounded p-4 bg-neutral-900">
      <h2 className="font-semibold text-lg">{product.title}</h2>
      <p className="text-sm text-neutral-400">{product.description}</p>
      <p className="mt-2 font-bold">
        R$ {(product.price / 100).toFixed(2)}
      </p>

      <button
        onClick={handleAddToCart}
        className="mt-4 w-full bg-green-600 hover:bg-green-700 p-2 rounded"
      >
        Adicionar ao carrinho
      </button>
    </div>
  );
}
