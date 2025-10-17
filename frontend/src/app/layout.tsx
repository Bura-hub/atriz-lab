import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atriz Lab - Dashboard",
  description: "Laboratorio Remoto de Robótica - Panel de Control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning={true} className="font-inter">
      <body className="font-inter antialiased">
        {children}
      </body>
    </html>
  );
}
