"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NavBar from "@/components/home/NavBar";
import Footer from "@/components/home/Footer";
import {
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
  const t = useTranslations("nav");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

const navLinks = [
  {
    key: "problem",
    label: t("problem"),
    href: "#problem",
  },
  {
    key: "howItWorks",
    label: t("howItWorks"),
    href: "#how-it-works",
  },
  {
    key: "benefits",
    label: t("benefits"),
    href: "#benefits",
  },
  {
    key: "testimonials",
    label: t("testimonials"),
    href: "#testimonials",
  },
  {
    key: "faq",
    label: t("faq"),
    href: "#faq",
  },
  {
    key: "contact",
    label: t("contact"),
    href: "#contact",
  },
];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0A0E27]">
      <NavBar
        brand={t("brand")}
        navLinks={navLinks}
        signInLabel={t("signIn")}
        bookCallLabel={t("bookCall")}
        scrolled={scrolled}
      />
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
