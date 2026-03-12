"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { DashboardMockup } from "./dashboard-mockup";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 via-blue-50/40 to-transparent -z-10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text column */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Automatizujte svoje uctovnictvo
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
              Automatizujte{" "}
              <span className="text-primary">80%</span> vasej
              <br />
              uctovnej prace
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Vexera spaja podnikatela a uctovnika na jednom mieste.
              Spracovavajte doklady, parujte platby a sledujte financie —
              automaticky a v realnom case.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl px-8 py-3.5 hover:opacity-90 transition-opacity text-base"
              >
                Zacat zadarmo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#ako-to-funguje"
                className="inline-flex items-center justify-center gap-2 border-2 border-primary/20 text-foreground font-semibold rounded-xl px-8 py-3.5 hover:bg-primary/5 transition-colors text-base"
              >
                <Play className="w-4 h-4 text-primary" />
                Pozriet demo
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              Ziadna kreditna karta. Zadarmo navzdy pre zakladny plan.
            </p>
          </div>

          {/* Dashboard mockup column */}
          <div className="animate-fade-in-up [animation-delay:200ms] hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
