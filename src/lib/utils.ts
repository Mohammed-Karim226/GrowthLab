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
      subject: "A Simple Idea That Could Double {channelName}'s Views in 90 Days",
      greeting: (name: string) => `Dear ${name || "Creator"},`,
      greetingTemplate: "Dear {name},",
      hook: "I came across {channelName} and I genuinely think your content has far more reach potential than it's currently getting. The way you approach {topic} is different — and that difference is exactly what makes you a strong candidate for content distribution.",
      body: "We take your long-form videos and transform them into a full distribution system — 20 to 30 short clips per video (30–60 sec), each built around a strong hook with SFX, B-rolls, and captions, formatted specifically for each platform.\n\nThe result: your content reaches new audiences, earns organic views, and keeps generating results — instead of fading within 24 hours of posting.\n\nWithin 3 months, your content will be distributed across all major social platforms, your views will scale, and your brand will grow alongside it.\n\nWe also work with a creator in a very similar niche — and we'd be happy to share the results we've achieved with them so far.",
      closing:
        "If this sounds interesting, visit our page or simply reply to this email and we'll be in touch right away.",
      cta: "Learn More About Our Service →",
      signoff: "Warm regards,",
    },
    friendly: {
      subject: "Your content deserves way more views — here's how 🚀",
      greeting: (name: string) => `Hey ${name || "there"}! 👋`,
      greetingTemplate: "Hey {name}! 👋",
      hook: "Checked out {channelName} and honestly — your content is way too good to be sitting at its current reach. The stuff you're putting out on {topic} hits different, and I think you're leaving a lot of views on the table.",
      body: "Here's what we do: we take one of your long videos and turn it into 20–30 short clips — Reels, Shorts, TikToks — with proper hooks, captions, SFX, and B-rolls, tailored for each platform.\n\nYour content stops dying after 24 hours and starts compounding instead.\n\nWe've done this for a creator in your exact niche and the results speak for themselves — happy to show you if you're curious.\n\n3 months in and your channel looks completely different.",
      closing:
        "Check out our page or just hit reply — zero pressure, just a quick call about what's possible.",
      cta: "See How It Works →",
      cta2: "Chat With Us on WhatsApp →",
      signoff: "Cheers,",
    },
  },
  ar: {
    professional: {
      subject: "فكرة بسيطة ممكن تضاعف مشاهدات {channelName} خلال 90 يوم",
      greeting: (name: string) =>
        `السلام عليكم ورحمة الله وبركاته،\n(${name || "صاحب القناة"})`,
      greetingTemplate: "السلام عليكم ورحمة الله وبركاته،\n({name})",
      hook: "اتفرجت على محتوى {channelName}، وفكرة {topic} عندكم مختلفة جًدا ومش منتشرة بنفس الشكل في المحتوى العربي — وده في حد ذاته بيخلي عندكم فرصة انتشار كبيرة جًدا لو اتوظفت صح.",
      body: "إحنا بنشتغل كموزعين محتوى محترفين — بناخد الفيديو الأساسي ونطلع منه ما بين 20–30 مقطع قصير (30–60 ثانية)، مع تركيز على أقوى الأفكار والجمل المؤثرة (Hook)، وإضافة SFX وB-rolls وCaption، وتجهيز المحتوى بالشكل المناسب لكل منصة.\n\nالنتيجة: محتواك بيوصل لجمهور جديد، ويكسب مشاهدات أورجانيك، ويفضل شغال بدل ما ينتهي خلال 24 ساعة من النشر.\n\nخلال 3 شهور — محتواك هيكون منتشر على جميع منصات السوشيال، مشاهداتك هتتضاعف، والبراند بتاعك هيكبر بشكل ملحوظ.\n\nكمان عندنا صانع محتوى في نفس مجالك بالظبط لسا شغال معانا — ولو حابب ممكن أوريك النتائج اللي وصلنا ليها معاه.",
      closing:
        "لو الفكرة عجبتك وعايز تعرف أكتر عن الخدمة — زور صفحتنا أو رد على الإيميل  او ابعتلنا علي الواتس اب ده وهنتواصل معاك على طول.",
      cta: "اعرف أكتر عن خدمتنا ←",
      cta2: "تواصل معانا علي الواتس اب ←",
      signoff: "مع تحياتي،",
    },
    friendly: {
      subject: "محتواك يستاهل أكتر من كده — وعندنا الطريقة 🚀",
      greeting: (name: string) => `أهلاً ${name || "يا صديقي"}! 👋`,
      greetingTemplate: "أهلاً {name}! 👋",
      hook: "اتفرجت على {channelName} وبصراحة — المحتوى بتاعك أحسن بكتير من انتشاره الحالي. اللي بتعمله في {topic} مختلف، وحاسس إنك بتسيب مشاهدات كتير على الطاولة.",
      body: "إيه اللي بنعمله: بناخد فيديو واحد طويل ونحوله لـ 20–30 مقطع قصير — Reels وShorts وTikToks — بـ Hooks قوية وCaptions وSFX وB-rolls، كل ده متناسب مع كل منصة.\n\nالمحتوى بتاعك بيبطل يموت بعد 24 ساعة ويبدأ يتراكم بدل كده.\n\nعملنا نفس الكلام مع صانع محتوى في مجالك بالظبط والنتايج تتكلم عن نفسها — لو حابب أوريك. 3 شهور وقناتك هتبقى مختلفة تمامًا.",
      closing:
        "بص صفحتنا أو رد على الإيميل ده — مفيش أي ضغط، بس مكاملة سريعة عن اللي ممكن يحصل.",
      cta: "شوف إزاي بنشتغل ←",
      signoff: "تحياتي،",
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
    cta2: lang === "ar" ? "تواصل عبر واتساب ←" : "Chat With Us on WhatsApp →",
    signoff: t.signoff,
  };
}

export function generateHTML(form: FormState, content: ContentState, lang: Lang, fullDocument: boolean = false): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const fontFamily = "Manrope, Arial, sans-serif";

  let ctasHtml = "";
  if (form.bookingLink) {
    ctasHtml += `<div style="text-align:center;margin:8px 0;">
      <a href="${form.bookingLink}" style="display:inline-block;background:#2d3748;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:600;font-size:14px;font-family:${fontFamily};">${content.cta}</a>
    </div>`;
  }
  if (form.whatsappLink) {
    ctasHtml += `<div style="text-align:center;margin:8px 0;">
      <a href="${form.whatsappLink}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:600;font-size:14px;font-family:${fontFamily};">${content.cta2}</a>
    </div>`;
  }

  const contentHTML = `
<div dir="${dir}" style="margin:0;padding:0;background:#f2f2f2;font-family:${fontFamily};">
  <div dir="${dir}" style="max-width:600px;margin:16px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    ${form.logoUrl ? `<div style="padding:20px 20px 0;text-align:center;">
      <img src="${form.logoUrl}" alt="Logo" style="width:full;height: 240px;object-fit:block;" />
    </div>` : ""}
    <div style="padding:24px 20px;color:#2d3748;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 18px;">${content.greeting}</p>
      <p style="margin:0 0 14px;">${content.hook}</p>
      <p style="margin:0 0 20px;">${content.body}</p>
      <p style="margin:0 0 24px;">${content.closing}</p>
      ${ctasHtml}
      <p style="margin:20px 0 0;">${content.signoff}</p>
      <p style="margin:5px 0 0;font-weight:600;color:#2d3748;">${form.senderName || "Your Name"}</p>
      <p style="margin:2px 0 0;color:#718096;font-size:13px;">${form.senderTitle || "Brand Partnerships"}</p>
      <p style="margin:2px 0 0;color:#718096;font-size:13px;">${form.senderEmail || "hello@yourbrand.com"}</p>
    </div>
    <div style="padding:14px 20px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a0aec0;">${
        lang === "ar"
          ? 'الإيميل ده اتبعت كجزء من مبادرة تواصل مع صنّاع المحتوى. لو مش مهتم، رد بـ "مش مهتم" وهنشيل اسمك من القايمة.'
            : 'This email was sent as part of a content distribution outreach. Not interested? Just reply "Not interested" and we\'ll remove you immediately.'
      }</p>
    </div>
  </div>
</div>`;

  if (fullDocument) {
    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
</head>
<body style="margin:0;padding:0;">
${contentHTML}
</body>
</html>`;
  }

  return contentHTML;
}

// Helper to copy HTML to clipboard in a way that preserves formatting for Gmail
export async function copyHTMLToClipboard(html: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' });
  const data = [new ClipboardItem({ [blob.type]: blob })];
  
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.write(data);
      return;
    } catch (e) {
      // Fallback if ClipboardItem is not supported
    }
  }

  // Fallback: use textarea to copy HTML as plain text
  const textarea = document.createElement('textarea');
  textarea.value = html;
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!success) {
      throw new Error('Failed to copy');
    }
  } catch (err) {
    document.body.removeChild(textarea);
    throw err;
  }
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