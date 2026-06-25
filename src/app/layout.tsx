import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "AI-powered writing studio for novels, screenplays, and long-form projects. An AI that reads your characters, chapters, and notes — so you never have to repeat yourself.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Aissistant Writer",
    template: "%s — Aissistant Writer",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Aissistant Writer",
    title: "Aissistant Writer — AI writing assistant that knows your story",
    description: DESCRIPTION,
    url: APP_URL,
  },
  twitter: {
    card: "summary",
    title: "Aissistant Writer — AI writing assistant that knows your story",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
