import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    name: "Ing. Maria Kovacova",
    role: "Majitelka uctovnej kancelarie",
    company: "MK Ucto s.r.o.",
    quote:
      "Vexera nam usetri minimalne 15 hodin tyzdenne. Automaticke parovanie platieb a OCR su neuveritelne presne. Nasi klienti su spokojni s rychlostou spracovania.",
    initials: "MK",
  },
  {
    name: "Peter Horvath",
    role: "Konatel",
    company: "Digital Agency s.r.o.",
    quote:
      "Konecne mam prehlad o financiach firmy v realnom case. Nemusim cakat na mesacnu uzavierku — vidim trzby, naklady aj cashflow okamzite.",
    initials: "PH",
  },
  {
    name: "Ing. Jana Novakova",
    role: "Hlavna uctovnicka",
    company: "StartupHub a.s.",
    quote:
      "Prechod z manualneho spracovania dokladov na Vexeru bol jednoduchy. System sa naucil nase pravidla uz po prvom tyzdni pouzivania.",
    initials: "JN",
  },
];

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Co hovoria nasi klienti
          </h2>
          <p className="text-lg text-muted-foreground">
            Pribeh spokojnych firem a uctovnych kancelarii
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.initials}
              className="glass rounded-2xl border border-border/50 p-8 hover:shadow-lg transition-shadow cursor-default"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-current text-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground leading-relaxed mt-4 mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
