"use client";

import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Product } from "@/types/product";
import { addToCart } from "@/lib/cart";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const imageUrl = product.images?.[0]?.url || product.image_url;

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
      imageUrl: imageUrl || undefined,
      unitPrice: product.price,
    });

    toast.success("Produto adicionado ao carrinho");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      className="glass-panel group p-4"
    >
      <div className="relative mb-3 overflow-hidden rounded-xl">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.title}
            className="media-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="media-cover" />
        )}
        <span className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {product.stock > 0 ? "Disponivel" : "Sem estoque"}
        </span>
      </div>
      <h2 className="text-lg font-bold text-white">{product.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{product.description}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xl font-black text-emerald-300">R$ {(product.price / 100).toFixed(2)}</p>
        <p className="rounded-full bg-white/5 px-2 py-1 text-xs text-neutral-400">Estoque {product.stock}</p>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAddToCart}
        disabled={product.stock <= 0}
        className="ui-btn ui-btn-primary mt-4 w-full"
      >
        Adicionar ao carrinho
      </motion.button>
    </motion.div>
  );
}
