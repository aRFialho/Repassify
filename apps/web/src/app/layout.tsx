import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repassify Enterprise",
  description: "Cockpit de conciliacao financeira, repasses e regras."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
