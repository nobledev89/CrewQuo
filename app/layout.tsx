import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrewQuo - Contractor Management",
  description: "Multi-tenant contractor project management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
