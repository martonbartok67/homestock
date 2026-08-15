import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeStock — your home, in order",
  description: "A calm, practical home inventory and recipe planning workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
