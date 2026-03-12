"use client";

import { Upload, Cpu, CheckCircle } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: 1,
    icon: Upload,
    title: "Nahrajte doklady",
    description:
      "Nahrajte faktury, blocky a vypisy cez drag & drop, email alebo mobilom. System akceptuje PDF, JPG aj PNG.",
  },
  {
    number: 2,
    icon: Cpu,
    title: "System automaticky spracuje",
    description:
      "OCR vytazi udaje, pravidla priradia kategoriu a uctovne zapisy. 80% dokladov sa spracuje bez vasho zasahu.",
  },
  {
    number: 3,
    icon: CheckCircle,
    title: "Kontrolujte a schvalujte",
    description:
      "Skontrolujte navrhy systemu, schvalte alebo upravte jednym klikom. Hotovo — doklady su zauctovane.",
  },
];

export function HowItWorks() {
  const { ref, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>();

  return (
    <section id="ako-to-funguje" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ako to funguje?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tri jednoduche kroky k automatizovanemu uctovnictvu
          </p>
        </div>

        <div
          ref={ref}
          className="grid md:grid-cols-3 gap-8 lg:gap-12 relative"
        >
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 border-t-2 border-dashed border-primary/30" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={cn(
                  "text-center relative",
                  isIntersecting && "animate-fade-in-up"
                )}
                style={
                  isIntersecting
                    ? { animationDelay: `${index * 200}ms` }
                    : { opacity: 0 }
                }
              >
                {/* Numbered circle */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center relative z-10">
                  <Icon className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-primary mb-2">
                  Krok {step.number}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
