"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const navLinks = [
  { label: "Funkcie", href: "#funkcie" },
  { label: "Ako to funguje", href: "#ako-to-funguje" },
  { label: "Cennik", href: "#cennik" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "glass-strong border-b border-border/50 py-3"
          : "bg-transparent py-5",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-primary"
        >
          VEXERA
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href={`${appUrl}/login`}
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors px-4 py-2"
          >
            Prihlasit sa
          </Link>
          <Link
            href={`${appUrl}/register`}
            className="text-sm font-semibold bg-primary text-primary-foreground rounded-xl px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            Zacat zadarmo
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-foreground"
          aria-label={mobileOpen ? "Zavriet menu" : "Otvorit menu"}
        >
          {mobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden glass-strong border-t border-border/50 mt-2">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-foreground/70 hover:text-foreground py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Link
                href={`${appUrl}/login`}
                className="text-sm font-medium text-center py-2.5 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                Prihlasit sa
              </Link>
              <Link
                href={`${appUrl}/register`}
                className="text-sm font-semibold text-center bg-primary text-primary-foreground rounded-xl py-2.5 hover:opacity-90 transition-opacity"
              >
                Zacat zadarmo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
