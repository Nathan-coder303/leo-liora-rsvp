import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leo & Liora — August 13, 2026",
  description: "Wedding invitation and RSVP for Leo & Liora",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
