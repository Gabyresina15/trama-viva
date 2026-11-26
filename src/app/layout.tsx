import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const editorialSerif = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Trama Viva · La voz de quien lo hizo",
  description:
    "Pasaporte oral verificable y liquidación directa en USDC sobre Stellar Soroban para artesanos y salas colectivas de Salta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${editorialSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F6F0E6] text-[#1F1916] selection:bg-[#A64429]/20">
        <header className="sticky top-0 z-30 border-b border-[#DED2C2] bg-[#F6F0E6]/92 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-serif text-2xl font-semibold tracking-tight text-[#1F1916]">
                Trama Viva
              </span>
              <span className="hidden text-xs uppercase tracking-[0.18em] text-[#786758] sm:inline">
                Salta · Memoria Viva
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-xs font-medium sm:gap-3 sm:text-sm">
              <Link
                href="/artesana"
                className="rounded-full border border-[#D4C4B0] px-3 py-1.5 text-[#4B3E35] transition hover:border-[#A64429] hover:text-[#A64429]"
              >
                Mis cobros
              </Link>
              <Link
                href="/crear"
                className="rounded-full bg-[#A64429] px-3.5 py-1.5 text-[#FDF9F3] shadow-sm transition hover:bg-[#8C361E]"
              >
                + Grabar pieza
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-[#DED2C2] bg-[#EFE6D8] py-6 text-xs text-[#6B5B4E]">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <strong>Trama Viva</strong> · Memoria, Arte y Territorio (Salta · FLAT 2026)
            </p>
            <p className="font-mono text-[11px] text-[#7D6C5E]">
              Red de pruebas Stellar Testnet · Fondos demostrativos sin valor comercial
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
