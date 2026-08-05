import type { ReactNode } from "react";
import {
  BarChart2,
  Eye,
  Layers,
  Rocket,
  Search,
  TrendingUp,
  Users,
  Star,
  Zap,
  Target,
  Shield,
  Clapperboard,
  Scissors,
  Radio,
  Clock,
} from "lucide-react";

export type Tone = "professional" | "friendly";
export type Lang = "en" | "ar";

export interface FormState {
  creatorName: string;
  channelName: string;
  logoUrl: string;
  bookingLink: string;
  whatsappLink: string;
  tone: Tone;
  senderName: string;
  senderTitle: string;
  senderEmail: string;
  toEmail: string;
}

export interface ContentState {
  subject: string;
  greeting: string;
  hook: string;
  body: string;
  closing: string;
  cta: string;
  cta2: string;
  signoff: string;
}

export type StatCard = {
  target: number;
  suffix: string;
  label: string;
  icon: ReactNode;
  color: string;
};

export type SectionCard = {
  icon: ReactNode;
  title: string;
  desc: string;
};

export type BenefitCard = {
  icon: ReactNode;
  title: string;
  desc: string;
  color: string;
};

export type StepCard = {
  num: string;
  title: string;
  desc: string;
  icon: ReactNode;
};

export type Testimonial = {
  name: string;
  category: string;
  avatar: string;
  before: string;
  after: string;
  afterDays: number;
  monthlyViews?: number;
  quote: string;
};

export type FaqItem = {
  q: string;
  a: string;
};

export const navLinks = [
  "Services",
  "How It Works",
  "Results",
  "FAQ",
  "Contact",
];

export const stats: StatCard[] = [
  {
    target: 1000,
    suffix: "+",
    label: "Creators Joined",
    icon: <Users className="w-5 h-5" />,
    color: "#0891B2",
  },
  {
    target: 15000,
    suffix: "+",
    label: "Avg Subs in 90 Days",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "#3B82F6",
  },
  {
    target: 4.9,
    suffix: "/5",
    label: "Average Rating",
    icon: <Star className="w-5 h-5" />,
    color: "#F59E0B",
  },
];

export const problems: SectionCard[] = [
  {
    icon: <TrendingUp className="w-7 h-7" />,
    title: "Algorithm Shifts",
    desc: "Constant YouTube updates tank your reach without warning. Most creators never adapt.",
  },
  {
    icon: <Eye className="w-7 h-7" />,
    title: "Low Visibility",
    desc: "Great content buried under poor metadata and weak search signals.",
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: "Audience Mismatch",
    desc: "Attracting the wrong viewers that don't convert to subscribers or revenue.",
  },
  {
    icon: <BarChart2 className="w-7 h-7" />,
    title: "Inconsistent Growth",
    desc: "Random spikes followed by painful plateaus and no data-driven path forward.",
  },
];

export const steps: StepCard[] = [
  {
    num: "01",
    title: "Extract the Gold",
    desc: "We deeply analyze your long-form video to find the highest-impact hooks, emotional peaks, and proven audience magnets.",
    icon: <Clapperboard />,
  },
  {
    num: "02",
    title: "Repurpose at Scale",
    desc: "One video becomes six scroll-stopping vertical reels — each with custom hooks, captions, and platform-specific pacing.",
    icon: <Scissors />,
  },
  {
    num: "03",
    title: "Build Platform Foundations",
    desc: "We professionally warm up and optimize your Instagram, TikTok, Facebook, and YouTube accounts for maximum deliverability and trust.",
    icon: <Radio />,
  },
  {
    num: "04",
    title: "Launch & Amplify",
    desc: "Strategic, staggered publishing + smart distribution that triggers organic algorithms and compounds reach over time.",
    icon: <TrendingUp />,
  },
];

export const benefits: BenefitCard[] = [
  {
    icon: <Scissors className="w-6 h-6" />,
    title: "6X Content Output",
    desc: "Multiply every long-form video into six high-performing reels — dramatically increasing your content velocity without extra filming.",
    color: "#22D3EE",
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Explosive Organic Reach",
    desc: "Consistent short-form drops engineered to break through algorithms and land in front of fresh, highly engaged audiences.",
    color: "#3B82F6",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Community Compounding",
    desc: "Turn passive viewers into loyal subscribers and fans across multiple platforms — creating a self-sustaining growth flywheel.",
    color: "#F59E0B",
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Done-For-You Freedom",
    desc: "Reclaim 10–15 hours every week. Never worry about editing, formatting, or posting schedules again.",
    color: "#0891B2",
  },
  {
    icon: <Radio className="w-6 h-6" />,
    title: "Omnichannel Authority",
    desc: "Build a powerful, consistent brand presence across YouTube, TikTok, Instagram, Facebook & Shorts simultaneously.",
    color: "#A855F7",
  },
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: "Predictable Scaling System",
    desc: "A repeatable, data-backed system that delivers compounding views, engagement, and subscribers month after month.",
    color: "#EC4899",
  },
];
export const testimonials: Testimonial[] = [
  {
    name: "MoSewilam",
    category: "Analysis | Documentaries",
    avatar:
      "https://yt3.googleusercontent.com/XYlm-Ppn11c4I2xop3OG9zNru_sLiP--PfsBTsfbzTIRWekLTvWB1K4SxhG8E2_QtZEV1mwAIYQ=s160-c-k-c0x00ffffff-no-rj",
    before: "42k",
    after: "46.5k",
    afterDays: 30,
    monthlyViews: 1.0e6,
    quote:
      "The GrowthLab team helped me understand my audience and how to reach them. My channel is now growing faster than ever.",
  },
  {
    name: "Omar Jehad",
    category: "Analysis | Documentaries",
    avatar:
      "https://yt3.googleusercontent.com/u7oWuSuPz2Ox_qgYCOLxY2o7u6tsQhNG-B6iL3piVQo7GQIBErbud_JHG3B89WsJnFJ2Oka4sXQ=s160-c-k-c0x00ffffff-no-rj",
    before: "490k",
    after: "573k",
    afterDays: 90,
    monthlyViews: 11.0e6,
    quote:
      "The strategy they built doubled my CTR in 3 months. My channel finally has a clear direction.",
  },
  {
    name: "MOhammed Rifaat",
    category: "Crime Awareness Education",
    avatar:
      "https://yt3.googleusercontent.com/2iswcwM5v1_JxyzyWRoNhYO142HTTJFs5wy10fKjCsQmxwQAaeDYG9xLutMsXa6IWIlhssgv=s160-c-k-c0x00ffffff-no-rj",
    before: "325k",
    after: "335k",
    afterDays: 90,
    monthlyViews: 1.0e6,
    quote:
      "I was plateaued for 6 weeks. One discovery call later, everything changed. Real ROI.",
  },
];

export const faqs: FaqItem[] = [
  {
    q: "How quickly will I see results?",
    a: "Most creators see measurable growth within 60 days. Our average client gains +15k subscribers in the first 90-day engagement.",
  },
  {
    q: "Do you work with small channels?",
    a: "Absolutely. We work with channels at 500 subs and up. Early strategy sets the best compounding trajectory.",
  },
  {
    q: "What makes your approach different?",
    a: "We combine data-driven algorithm analysis with narrative storytelling strategy — covering both discovery and retention.",
  },
  {
    q: "Is there a long-term contract?",
    a: "No lock-ins. We offer month-to-month engagements. We earn your renewal every single month.",
  },
];

export const cardMeta = [
  {
    badge: "border-cyan-400/15 text-cyan-300",
    icon: "text-cyan-300",
    dot: "bg-cyan-300/80",
    hoverBg: "rgba(8,145,178,0.16)",
    callout: "Recover visibility with better metadata and title strategy.",
  },
  {
    badge: "border-emerald-400/15 text-emerald-300",
    icon: "text-emerald-300",
    dot: "bg-emerald-300/80",
    hoverBg: "rgba(16,185,129,0.16)",
    callout: "Turn viewers into subscribers with clearer positioning.",
  },
  {
    badge: "border-amber-400/15 text-amber-300",
    icon: "text-amber-300",
    dot: "bg-amber-300/80",
    hoverBg: "rgba(245,158,11,0.16)",
    callout: "Stop audience mismatch with a tighter content funnel.",
  },
  {
    badge: "border-rose-400/15 text-rose-300",
    icon: "text-rose-300",
    dot: "bg-rose-300/80",
    hoverBg: "rgba(244,114,182,0.16)",
    callout: "Smooth inconsistent growth with a data-driven cadence.",
  },
];
