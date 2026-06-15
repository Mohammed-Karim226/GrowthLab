"use client";

import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-white/10 bg-[#070b1f] py-14 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.32em] text-[#0891B2]">
            {t("brand")}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">
            {t("description")}
          </p>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-[#0891B2]" />
              <span>{t("location")}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[#0891B2]" />
              <a
                href={`mailto:${"sha080435@gmail.com"}`}
                className="transition hover:text-white"
              >
                growthlabagency2090@gmail.com
              </a>
            </div>
            <div className="pt-2">
              <a
                href="https://wa.me/201126421602"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#0891B2] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#067993] focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:ring-offset-2 focus:ring-offset-[#070b1f]"
              >
                <Phone className="h-4 w-4" />
                {t("chatOnWhatsApp")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
          {/* <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">
              {t("quickLinks")}
            </h3>
            <ul className="mt-6 space-y-3 text-sm text-slate-400">
              {[
                { label: "Services", href: "#services" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "Results", href: "#results" },
                { label: "FAQ", href: "#faq" },
              ].map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">
              {t("nextSteps")}
            </h3>
            <ul className="mt-6 space-y-3 text-sm text-slate-400">
              <li>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 transition hover:text-white"
                >
                  {t("bookCall")} <ArrowUpRight className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a
                  href="mailto:growthlabagency2090@gmail.com"
                  className="transition hover:text-white"
                >
                  {t("emailTeam")}
                </a>
              </li>
              <li>
                <a href="#benefits" className="transition hover:text-white">
                  {t("reviewModel")}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-slate-500">
          © {new Date().getFullYear()} GrowthLab. Trusted by creators building
          brands for the modern creator economy.
        </p>
      </div>
    </footer>
  );
}
