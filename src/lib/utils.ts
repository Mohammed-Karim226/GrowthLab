import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { FormState } from "@/lib/landing";
import { twMerge } from "tailwind-merge"
import { Lang, Tone, ContentState } from "./landing";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const toneMap = {
  en: {
    professional: {
      subject: "Partnership Inquiry – Brand Collaboration Opportunity",
      greeting: (name: string) => `Dear ${name || "Creator"},`,
      greetingTemplate: "Dear {name},",
      hook: "I hope this message finds you well. I am reaching out on behalf of our brand to explore a potential collaboration opportunity that aligns with your content and audience.",
      body: "After reviewing your channel, we believe your engaged community and consistent content quality make you an ideal partner for our upcoming campaign. We would love to discuss how we can create mutual value through an authentic partnership.",
      closing: "I would be delighted to schedule a brief call at your convenience to outline the details and explore how we can move forward.",
      cta: "Schedule a Discovery Call",
      signoff: "Warm regards,",
    },
    friendly: {
      subject: "Hey! Let's Collab 🚀 – Brand Deal Inside",
      greeting: (name: string) => `Hey ${name || "there"}! 👋`,
      greetingTemplate: "Hey {name}! 👋",
      hook: "Big fan of your content — your videos have been genuinely amazing and your community is super engaged! I've been following your channel for a while and I think we'd be a perfect match.",
      body: "We're a brand that's growing fast and we're looking for authentic creators like you to be part of something exciting. No boring scripts — just real, fun collaboration that fits your style and resonates with your audience.",
      closing: "Let's jump on a quick call and see if we vibe! Totally low-pressure, just a friendly chat about the possibilities.",
      cta: "Let's Talk! Book a Call 🎯",
      signoff: "Cheers,",
    },
  },
  ar: {
    professional: {
      subject: "استفسار شراكة – فرصة تعاون مع علامتنا التجارية",
      greeting: (name: string) => `عزيزي ${name || "صاحب القناة"}،`,
      greetingTemplate: "عزيزي {name}،",
      hook: "أتمنى أن تكون بخير. أتواصل معك نيابةً عن علامتنا التجارية لاستكشاف فرصة تعاون محتملة تتوافق مع محتواك وجمهورك المتميز.",
      body: "بعد مراجعة قناتك، نعتقد أن مجتمعك المتفاعل وجودة المحتوى المنتظمة تجعلك شريكًا مثاليًا لحملتنا القادمة. نودّ مناقشة كيف يمكننا خلق قيمة مشتركة من خلال شراكة حقيقية وأصيلة.",
      closing: "يسعدني جدولة مكالمة قصيرة في الوقت المناسب لك لاستعراض التفاصيل والتباحث حول كيفية المضي قدمًا في هذه الفرصة.",
      cta: "احجز مكالمة اكتشاف",
      signoff: "مع خالص التقدير،",
    },
    friendly: {
      subject: "مرحبًا! تعاون مثير ينتظرك 🚀",
      greeting: (name: string) => `أهلاً ${name || "يا صديقي"}! 👋`,
      greetingTemplate: "أهلاً {name}! 👋",
      hook: "من أكبر المعجبين بمحتواك — فيديوهاتك رائعة حقًا وجمهورك متفاعل بشكل مذهل! أتابع قناتك منذ فترة وأعتقد أننا سنشكّل ثنائيًا مثاليًا.",
      body: "نحن علامة تجارية تنمو بسرعة ونبحث عن صنّاع محتوى أصيلين مثلك للانضمام إلى شيء مثير. لا سكريبتات مملة — فقط تعاون حقيقي وممتع يناسب أسلوبك ويتناسب مع جمهورك.",
      closing: "هيا نقفز في مكالمة سريعة ونرى إذا كان هناك تناغم! بدون ضغط، مجرد دردشة ودية عن الاحتمالات الرائعة.",
      cta: "تحدث معنا! احجز مكالمة 🎯",
      signoff: "مع تحياتي،",
    },
  },
};

export function getDefaultContent(lang: Lang, tone: Tone, creatorName: string): ContentState {
  const t = toneMap[lang][tone];
  return {
    subject: t.subject,
    greeting: t.greeting(creatorName),
    hook: t.hook,
    body: t.body,
    closing: t.closing,
    cta: t.cta,
    signoff: t.signoff,
  };
}

export function generateHTML(form: FormState, content: ContentState, lang: Lang): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const fontFamily = "Manrope, Arial, sans-serif";

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:${fontFamily};">
<div dir="${dir}" style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  ${form.logoUrl ? `<div style="padding:24px 40px 0;text-align:center;">
    <img src="${form.logoUrl}" alt="Logo" style="max-height:64px;max-width:200px;object-fit:contain;" />
  </div>` : ""}
  <div style="padding:32px 40px;color:#2d3748;font-size:15px;line-height:1.7;">
    <p style="margin:0 0 20px;">${content.greeting}</p>
    <p style="margin:0 0 16px;">${content.hook}</p>
    <p style="margin:0 0 24px;">${content.body}</p>
    <p style="margin:0 0 28px;">${content.closing}</p>
    ${form.bookingLink ? `<div style="text-align:center;margin:32px 0;">
      <a href="${form.bookingLink}" style="display:inline-block;background:#2d3748;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;font-family:${fontFamily};">${content.cta}</a>
    </div>` : ""}
    <p style="margin:24px 0 0;">${content.signoff}</p>
    <p style="margin:6px 0 0;font-weight:600;color:#2d3748;">${form.senderName || "Your Name"}</p>
    <p style="margin:2px 0 0;color:#718096;font-size:13px;">${form.senderTitle || "Brand Partnerships"}</p>
    <p style="margin:2px 0 0;color:#718096;font-size:13px;">${form.senderEmail || "hello@yourbrand.com"}</p>
  </div>
  <div style="padding:16px 40px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#a0aec0;">This email was sent as part of a brand outreach initiative. To unsubscribe, reply with "Unsubscribe".</p>
  </div>
</div>
</body>
</html>`;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) resolve();
      else reject(new Error("execCommand copy failed"));
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}