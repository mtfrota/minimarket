import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "MiniMarket",
  description: "Marketplace simples",
};

const themeInitScript = `
try {
  const storedTheme = localStorage.getItem("minimkt:theme");
  const theme = storedTheme === "light" ? "light" : "dark";
  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(theme === "light" ? "theme-light" : "theme-dark");
  document.documentElement.style.colorScheme = theme;
} catch (_) {
  document.documentElement.classList.add("theme-dark");
  document.documentElement.style.colorScheme = "dark";
}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
