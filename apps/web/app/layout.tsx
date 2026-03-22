import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learnova LMS",
  description: "A modern, creative learning management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-background text-foreground antialiased selection:bg-accent-blue selection:text-white flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
