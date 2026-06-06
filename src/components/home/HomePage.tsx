"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/home/NavBar";
import Footer from "@/components/home/Footer";
import {
  navLinks,
  problems,
  steps,
  benefits,
  stats,
  testimonials,
  faqs,
} from "@/lib/landing";
import HeroSection from "./HeroSection";
import StatsBar from "./StatsBar";
import ProblemSection from "./ProblemSection";
import HowItWorksSection from "./HowItWorksSection";
import BenefitsSection from "./BenefitsSection";
import TestimonialsSection from "./TestimonialsSection";
import FaqSection from "./FaqSection";
import ContactSection from "./ContactSection";

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0A0E27]">
      <NavBar navLinks={navLinks} scrolled={scrolled} />
      <main className="pt-20">
        <HeroSection />
        <StatsBar stats={stats} />
        <ProblemSection problems={problems} />
        <HowItWorksSection steps={steps} />
        <BenefitsSection benefits={benefits} />
        <TestimonialsSection testimonials={testimonials} />
        <FaqSection faqs={faqs} {...({ openFaq, onToggle: setOpenFaq } as any)} />
        <ContactSection />
        <Footer />
      </main>
    </div>
  );
}
