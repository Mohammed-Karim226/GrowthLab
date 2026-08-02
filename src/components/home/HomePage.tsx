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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const t = useTranslations("nav");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setScrollProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const ids = [
      "problem",
      "how-it-works",
      "benefits",
      "testimonials",
      "faq",
      "contact",
    ];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-cyan-400 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        {t("skipToContent")}
      </a>
      <NavBar
        brand={t("brand")}
        navLinks={navLinks}
        signInLabel={t("signIn")}
        bookCallLabel={t("bookCall")}
        scrolled={scrolled}
        activeSection={activeSection}
        scrollProgress={scrollProgress}
      />
      <main id="main" className="pt-20">
        <HeroSection />
        <StatsBar stats={stats} />
        <ProblemSection problems={problems} />
        <HowItWorksSection steps={steps} />
        <BenefitsSection benefits={benefits} />
        <TestimonialsSection testimonials={testimonials} />
        <FaqSection
          faqs={faqs}
          {...({ openFaq, onToggle: setOpenFaq } as any)}
        />
        <ContactSection />
        <Footer />
      </main>
    </div>
  );
}
