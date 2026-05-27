import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Budget",
  description: "Household budgeting and planning",
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
