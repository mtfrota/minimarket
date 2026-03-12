"use client";

import Header from "@/components/Header";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <Header />

      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto max-w-6xl p-6 pt-20 sm:pt-24 lg:pt-32"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2200,
          className: "min-w-[240px] border border-white/10 bg-neutral-900 text-neutral-100 shadow-2xl",
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#052e16",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#450a0a",
            },
          },
        }}
      />
    </div>
  );
}
