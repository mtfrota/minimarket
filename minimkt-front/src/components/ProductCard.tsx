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
      transition={{ duration: 0.18 }}
      className="glass-panel p-4"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={product.title}
          className="media-cover mb-3"
        />
      ) : null}
      <h2 className="font-semibold text-lg">{product.title}</h2>
      <p className="text-sm text-neutral-400">{product.description}</p>
      <p className="mt-2 font-bold">R$ {(product.price / 100).toFixed(2)}</p>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAddToCart}
        className="ui-btn ui-btn-primary mt-4 w-full"
      >
        Adicionar ao carrinho
      </motion.button>
    </motion.div>
  );
}
