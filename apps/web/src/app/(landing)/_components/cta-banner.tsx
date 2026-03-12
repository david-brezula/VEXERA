import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaBanner() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 -z-10" />
      {/* Decorative circles */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
          Zacnite automatizovat vase uctovnictvo este dnes
        </h2>
        <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
          Pripojte sa k firmam a uctovnym kancelariam, ktore uz setria cas a peniaze
          s Vexerou. Zacnite zadarmo — ziadna kreditna karta.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold rounded-xl px-10 py-4 text-lg hover:bg-white/90 transition-colors shadow-lg shadow-black/20"
        >
          Zacat zadarmo
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}
