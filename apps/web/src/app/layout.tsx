import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repassify Enterprise",
  description: "Cockpit de conciliacao financeira, repasses e regras.",
  icons: {
    icon: [
      { url: "/imgs/icon-teal.png", type: "image/png" },
      { url: "/imgs/icon-dark.png", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/imgs/icon-light.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/imgs/icon-teal.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
