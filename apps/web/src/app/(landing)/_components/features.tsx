"use client";

import {
  FileText,
  ScanSearch,
  Landmark,
  GitMerge,
  BookOpen,
  Mail,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: FileText,
    title: "Fakturacia",
    description:
      "Vystavujte, prijimajte a sledujte faktury. Generujte profesionalne PDF s vasim logom a automaticky posielajte klientom.",
  },
  {
    icon: ScanSearch,
    title: "Dokumenty & OCR",
    description:
      "Nahrajte doklady a system automaticky vytazi udaje. Rozpozna dodavatela, sumy, DPH a navrhne kategoriu.",
  },
  {
    icon: Landmark,
    title: "Bankove vypisy",
    description:
      "Importujte bankove vypisy vo formate CSV alebo MT940. Prehladne zobrazenie pohybov a stavov na uctoch.",
  },
  {
    icon: GitMerge,
    title: "Automaticke parovanie",
    description:
      "System na zaklade VS, sumy a partnera automaticky sparuje platby s fakturami. Usetrite hodiny manualnej prace.",
  },
  {
    icon: BookOpen,
    title: "Uctovna kniha",
    description:
      "Podvojne uctovnictvo so slovenskou uctovou osnovnou. Automaticke uctovne zapisy na zaklade pravidiel.",
  },
  {
    icon: Mail,
    title: "Email integracia",
    description:
      "Pripojte Gmail alebo Outlook a system automaticky stiahne faktury z priloh vasich emailov.",
  },
  {
    icon: Users,
    title: "Timovy pristup",
    description:
      "Pozvite uctovnika, kolegov alebo klientov. Nastavte role a pristupove prava pre kazdeho clena timu.",
  },
  {
    icon: BarChart3,
    title: "Dashboardy & Reporty",
    description:
      "Real-time prehlady o trzbach, nakladoch, DPH a cashflow. Sledujte financne zdravie vasej firmy.",
  },
];

function FeatureRow({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const { ref, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({ threshold: 0.2 });
  const isOdd = index % 2 === 0; // 0-indexed: even index = text on left
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={cn(
        "grid md:grid-cols-2 gap-8 lg:gap-16 items-center py-12 lg:py-16",
        isIntersecting && (isOdd ? "animate-fade-in-left" : "animate-fade-in-right"),
        !isIntersecting && "opacity-0"
      )}
    >
      {/* Text column */}
      <div className={cn("space-y-4", !isOdd && "md:order-2")}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
          {feature.title}
        </h3>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>

      {/* Visual placeholder */}
      <div className={cn(!isOdd && "md:order-1")}>
        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 p-8 flex flex-col items-center justify-center min-h-[280px] relative overflow-hidden">
          <Icon className="w-16 h-16 text-primary/40" />
          {/* Decorative shapes */}
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/10" />
          <div className="absolute bottom-6 left-6 w-12 h-3 rounded-full bg-primary/10" />
          <div className="absolute top-1/3 left-4 w-4 h-4 rounded bg-primary/5 rotate-45" />
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="funkcie" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Co ponuka Vexera?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Vsetko co potrebujete na spravu vasej firmy na jednom mieste
          </p>
        </div>

        <div>
          {features.map((feature, index) => (
            <FeatureRow key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
