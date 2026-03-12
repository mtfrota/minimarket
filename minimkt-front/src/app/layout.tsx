import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "MiniMarket",
  description: "Marketplace simples",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <Header />
        <main className="mx-auto max-w-6xl p-6 pt-20 sm:pt-24 lg:pt-32">{children}</main>
      </body>
    </html>
  );
}
