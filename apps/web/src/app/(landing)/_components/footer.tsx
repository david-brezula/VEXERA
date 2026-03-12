import Link from "next/link";

const productLinks = [
  { label: "Funkcie", href: "#funkcie" },
  { label: "Ako to funguje", href: "#ako-to-funguje" },
  { label: "Cennik", href: "#cennik" },
  { label: "Integracie", href: "#integracie" },
];

const companyLinks = [
  { label: "O nas", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Kariera", href: "#" },
  { label: "Kontakt", href: "#kontakt" },
];

const legalLinks = [
  { label: "Podmienky pouzivania", href: "#" },
  { label: "Ochrana sukromia", href: "#" },
  { label: "GDPR", href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="text-2xl font-extrabold text-white tracking-tight mb-4">
              VEXERA
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Automatizacia uctovnictva pre slovenske firmy a uctovne kancelarie. Faktury,
              dokumenty a financie na jednom mieste.
            </p>
            {/* Social placeholders */}
            <div className="flex gap-3">
              {["Li", "Fb", "Ig"].map((icon) => (
                <div
                  key={icon}
                  className="w-9 h-9 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  {icon}
                </div>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Produkt</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Firma</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Kontakt</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>info@vexera.sk</li>
              <li>+421 900 000 000</li>
              <li>Bratislava, Slovensko</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/register"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Zacat zadarmo →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">© 2026 Vexera. Vsetky prava vyhradene.</p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
