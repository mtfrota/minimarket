import "./globals.css";
import AppShell from "@/components/AppShell";

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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
