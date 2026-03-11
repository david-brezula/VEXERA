import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vexera — Automatizujte svoje uctovnictvo",
  description:
    "Vexera automatizuje 80% rutinnych uctovnych uloh. Spravujte faktury, dokumenty a uctovnictvo na jednom mieste. Pre slovenske firmy a uctovne kancelarie.",
  keywords: [
    "uctovnictvo",
    "fakturacia",
    "uctovny softver",
    "slovensko",
    "automatizacia",
    "SaaS",
    "uctovna kancelaria",
  ],
  openGraph: {
    title: "Vexera — Automatizujte svoje uctovnictvo",
    description:
      "Automatizujte 80% rutinnych uctovnych uloh. Faktury, dokumenty a uctovnictvo na jednom mieste.",
    type: "website",
    locale: "sk_SK",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk" className={plusJakartaSans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
