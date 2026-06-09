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
  quote: string;
};

export type FaqItem = {
  q: string;
  a: string;
};

export const navLinks = ["Services", "How It Works", "Results", "FAQ", "Contact"];

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
    name: "Sarah Chen",
    category: "Tech Reviews",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-1",
    before: "12k",
    after: "98k",
    quote: "The strategy they built doubled my CTR in 6 weeks. My channel finally has a clear direction.",
  },
  {
    name: "Marcus Williams",
    category: "Personal Finance",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-2",
    before: "8k",
    after: "64k",
    quote: "I was plateaued for 8 months. One discovery call later, everything changed. Real ROI.",
  },
  {
    name: "Aisha Patel",
    category: "Lifestyle & Wellness",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-5",
    before: "22k",
    after: "187k",
    quote: "Their analytics dashboard gave me visibility I never had. Growth went parabolic.",
  },
  {
    name: "Ryan Torres",
    category: "Gaming & Esports",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-4",
    before: "5k",
    after: "43k",
    quote: "Worth every dollar. They treated my channel like a business, not a hobby.",
  },
  {
    name: "Emma Johansson",
    category: "Education",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-7",
    before: "31k",
    after: "210k",
    quote: "Retention went from 38% to 62%. The watch-time spike triggered a massive algorithm push.",
  },
  {
    name: "David Kim",
    category: "Cooking & Food",
    avatar: "https://api.dicebear.com/6.x/identicon/svg?seed=avatar-8",
    before: "9k",
    after: "71k",
    quote: "They found the exact niche angle I was missing. Channel exploded in 90 days.",
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
  {
    q: "Can you help with monetization?",
    a: "Yes. We cover AdSense, sponsorships, memberships, and digital products as part of our revenue track.",
  },
];

export  const cardMeta = [
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