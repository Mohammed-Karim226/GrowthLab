import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#070b1f] py-14 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.32em] text-[#0891B2]">GrowthLab</p>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">
            We help ambitious creators and founders build a content engine that delivers predictable growth, stronger retention, and higher revenue.
          </p>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-[#0891B2]" />
              <span>Remote-first team, worldwide</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[#0891B2]" />
              <span>hello@growthlab.com</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-[#0891B2]" />
              <span>+1 (555) 123-9876</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">Quick links</h3>
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
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">Next steps</h3>
            <ul className="mt-6 space-y-3 text-sm text-slate-400">
              <li>
                <a href="#contact" className="inline-flex items-center gap-2 transition hover:text-white">
                  Book a free call <ArrowUpRight className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="mailto:hello@growthlab.com" className="transition hover:text-white">
                  Email our growth team
                </a>
              </li>
              <li>
                <a href="#services" className="transition hover:text-white">
                  Review the service model
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-slate-500">
          © {new Date().getFullYear()} GrowthLab. Trusted by creators building brands for the modern creator economy.
        </p>
      </div>
    </footer>
  );
}
