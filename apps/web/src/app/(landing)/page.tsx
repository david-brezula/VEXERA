import { Navbar } from "./_components/navbar";
import { Hero } from "./_components/hero";
import { StatsBar } from "./_components/stats-bar";
import { Features } from "./_components/features";
import { HowItWorks } from "./_components/how-it-works";
import { Testimonials } from "./_components/testimonials";
import { Integrations } from "./_components/integrations";
import { Pricing } from "./_components/pricing";
import { CtaBanner } from "./_components/cta-banner";
import { Footer } from "./_components/footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Integrations />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
