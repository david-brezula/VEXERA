"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const tiers = [
  {
    name: "Start",
    description: "Idealny na zaciatok",
    monthlyPrice: 0,
    annualPrice: 0,
    cta: "Zacat zadarmo",
    ctaStyle: "outline" as const,
    popular: false,
    features: [
      { text: "1 firma", included: true },
      { text: "Zakladna fakturacia", included: true },
      { text: "Upload dokladov", included: true },
      { text: "Uctovna kniha", included: true },
      { text: "Email podpora", included: true },
      { text: "Automaticke parovanie", included: false },
      { text: "OCR spracovanie", included: false },
      { text: "API pristup", included: false },
    ],
  },
  {
    name: "Profesional",
    description: "Pre rastuce firmy",
    monthlyPrice: 29,
    annualPrice: 23,
    cta: "Zacat skusobnu verziu",
    ctaStyle: "solid" as const,
    popular: true,
    features: [
      { text: "Neobmedzene firmy", included: true },
      { text: "Pokrocila fakturacia", included: true },
      { text: "Upload dokladov", included: true },
      { text: "Uctovna kniha", included: true },
      { text: "Prioritna podpora", included: true },
      { text: "Automaticke parovanie", included: true },
      { text: "OCR spracovanie", included: true },
      { text: "API pristup", included: false },
    ],
  },
  {
    name: "Enterprise",
    description: "Pre uctovne kancelarie",
    monthlyPrice: null,
    annualPrice: null,
    cta: "Kontaktujte nas",
    ctaStyle: "outline" as const,
    popular: false,
    features: [
      { text: "Neobmedzene firmy", included: true },
      { text: "Vsetky funkcie", included: true },
      { text: "Dedickovany support", included: true },
      { text: "SLA garancia", included: true },
      { text: "Custom integracie", included: true },
      { text: "Automaticke parovanie", included: true },
      { text: "OCR spracovanie", included: true },
      { text: "API pristup", included: true },
    ],
  },
];

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="cennik" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Jednoduchy a transparentny cennik
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Ziadne skryte poplatky. Zacnite zadarmo a upgradnite kedykolvek.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all",
                !isAnnual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Mesacne
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all",
                isAnnual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Rocne
              <span className="ml-1.5 text-xs font-semibold text-primary">-20%</span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-2xl p-8 transition-shadow",
                tier.popular
                  ? "border-2 border-primary shadow-xl shadow-primary/10 scale-105 bg-white"
                  : "border border-border glass"
              )}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full">
                  Najoblubenejsi
                </div>
              )}

              <h3 className="text-xl font-bold text-foreground mb-1">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>

              <div className="mb-6">
                {tier.monthlyPrice !== null ? (
                  <>
                    <span className="text-5xl font-extrabold text-foreground">
                      {isAnnual ? tier.annualPrice : tier.monthlyPrice} €
                    </span>
                    <span className="text-muted-foreground ml-1">/mesiac</span>
                  </>
                ) : (
                  <span className="text-3xl font-extrabold text-foreground">Na mieru</span>
                )}
              </div>

              <Link
                href={tier.popular ? `${appUrl}/register` : tier.name === "Enterprise" ? "#kontakt" : `${appUrl}/register`}
                className={cn(
                  "block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all",
                  tier.ctaStyle === "solid"
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border-2 border-border text-foreground hover:bg-muted"
                )}
              >
                {tier.cta}
              </Link>

              <ul className="mt-8 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3 text-sm">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={cn(feature.included ? "text-foreground" : "text-muted-foreground/60")}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
