import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "SAMC GME FM Events Signup",
  description: "Sign up for SAMC GME Family Medicine rotation events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <section className="content">{children}</section>
        <Analytics />
      </body>
    </html>
  );
}
