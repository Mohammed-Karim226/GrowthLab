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

export const navLinks = ["Services", "How It Works", "Results", "FAQ"];

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
    title: "Discovery",
    desc: "Deep audit of your channel, competitors, and niche landscape to understand your current position.",
    icon: <Search className="w-6 h-6" />,
  },
  {
    num: "02",
    title: "Analysis",
    desc: "Data forensics across views, retention, CTR, and algorithm signals to pinpoint gaps.",
    icon: <BarChart2 className="w-6 h-6" />,
  },
  {
    num: "03",
    title: "Strategy",
    desc: "Custom 90-day growth blueprint covering content, packaging, and publishing cadence.",
    icon: <Layers className="w-6 h-6" />,
  },
  {
    num: "04",
    title: "Implementation",
    desc: "Weekly execution support, live reviews, and real-time optimizations until targets are hit.",
    icon: <Rocket className="w-6 h-6" />,
  },
];

export const benefits: BenefitCard[] = [
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: "Algorithm Intelligence",
    desc: "We decode each update so your content always surfaces at the top.",
    color: "#0891B2",
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Niche Positioning",
    desc: "Carve a defensible space in your category that attracts the right audience.",
    color: "#3B82F6",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Rapid Iteration",
    desc: "Weekly content sprints with real-time feedback loops for faster learning.",
    color: "#F59E0B",
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: "Thumbnail Mastery",
    desc: "Click-through rate optimization backed by A/B test data across 1000+ videos.",
    color: "#0891B2",
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Full Funnel Strategy",
    desc: "From discovery to retention to monetization — every stage engineered.",
    color: "#3B82F6",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Risk Mitigation",
    desc: "Protect your channel from policy issues and algorithm penalties proactively.",
    color: "#F59E0B",
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
    a: "Most creators see measurable growth within 30 days. Our average client gains +15k subscribers in the first 90-day engagement.",
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
