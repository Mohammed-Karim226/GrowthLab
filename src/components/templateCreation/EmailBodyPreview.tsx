"use client";

import type { FormState, ContentState, Lang } from "@/lib/landing";

interface EmailBodyPreviewProps {
  form: FormState;
  content: ContentState;
  lang: Lang;
}

export default function EmailBodyPreview({ form, content, lang }: EmailBodyPreviewProps) {
  const isRTL = lang === "ar";
  return (
    
<div
dir={isRTL ? "rtl" : "ltr"}
className="mx-auto max-w-[600px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl"
>
{/* Brand Accent Bar */}



    {/* Header */}
    <div className="border-b border-border bg-background">
    
        <div className="w-full flex h-[90px] sm:h-[110px] items-center justify-center px-4 sm:px-8">
          <img
            src={ '/images/brandLogo.jpeg'}
            alt="Brand Logo"
            className="w-full max-h-[70px] sm:max-h-[85px] max-w-[240px] sm:max-w-[300px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
     
    </div>

    {/* Email Content */}
    <div className="px-4 sm:px-8 lg:px-12 py-6 sm:py-10 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-foreground">
      {/* Greeting */}
      <p className="mb-4 sm:mb-6 text-base font-semibold">
        {content.greeting}
      </p>

      {/* Hook */}
      <p className="mb-4 sm:mb-5 whitespace-pre-wrap text-muted-foreground">
        {content.hook}
      </p>

      {/* Main Body */}
      <p className="mb-6 sm:mb-8 whitespace-pre-wrap text-muted-foreground">
        {content.body}
      </p>

      {/* Closing */}
      <p className="mb-8 sm:mb-10 whitespace-pre-wrap text-muted-foreground">
        {content.closing}
      </p>

      {/* CTA */}
      {form.bookingLink ? (
        <div className="my-8 sm:my-10 text-center">
          <a
            href={form.bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center rounded-full bg-primary px-6 sm:px-8 py-2.5 sm:py-3 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-all hover:scale-[1.02] hover:bg-primary/90"
          >
            {content.cta}
          </a>
        </div>
      ) : (
        <div className="my-8 sm:my-10 text-center">
          <div className="inline-flex items-center rounded-full border border-dashed border-border bg-muted px-6 sm:px-8 py-2.5 sm:py-3 text-[11px] sm:text-xs text-muted-foreground">
            {isRTL
              ? "← أضف رابط الحجز لإظهار زر الدعوة للإجراء"
              : "Add a booking link to display the CTA button →"}
          </div>
        </div>
      )}

      {/* Signature */}
      <div className="mt-10 sm:mt-12 border-t border-border pt-6 sm:pt-8">
        <p className="mb-2 sm:mb-3 text-muted-foreground">
          {content.signoff}
        </p>

        <p className="mb-1 text-sm font-bold text-foreground">
          {form.senderName ||
            (isRTL ? "اسمك هنا" : "Your Name")}
        </p>

        <p className="mb-1 text-xs text-muted-foreground">
          {form.senderTitle ||
            (isRTL
              ? "مدير الشراكات"
              : "Brand Partnerships Manager")}
        </p>

        <p className="text-xs text-muted-foreground">
          {form.senderEmail || "hello@yourbrand.com"}
        </p>
      </div>
    </div>

    {/* Footer */}
    <div className="border-t border-border bg-muted/40 px-4 sm:px-8 py-4 sm:py-5">
      <p className="text-center text-[10px] sm:text-[11px] leading-4 sm:leading-5 text-muted-foreground">
        {isRTL
          ? 'تم إرسال هذا البريد كجزء من مبادرة التواصل مع المنشئين. لإلغاء الاشتراك، يرجى الرد بكلمة "إلغاء الاشتراك".'
          : 'This email was sent as part of a creator outreach initiative. To unsubscribe, simply reply with "Unsubscribe".'}
      </p>
    </div>
  
</div>    
  );
}
