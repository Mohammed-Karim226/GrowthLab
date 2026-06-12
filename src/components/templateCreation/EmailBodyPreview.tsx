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
    <div className="shadow-lg" style={{ background: "#f2f2f2", padding: "24px 16px", minHeight: "480px" }}>
      <div dir={isRTL ? "rtl" : "ltr"} style={{
        maxWidth: "560px",
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: "4px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: "Manrope, Arial, sans-serif",
      }}>
        {form.logoUrl && (
          <div style={{ padding: "24px 40px 0", textAlign: "center" }}>
            <img src={form.logoUrl} alt="Brand Logo"
              style={{ maxHeight: "64px", maxWidth: "200px", objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        {!form.logoUrl && (
          <div style={{ padding: "20px 32px 0", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f7fafc", borderRadius: "8px", padding: "10px 20px", border: "1px dashed #cbd5e0" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>🏷️</div>
              <span style={{ fontSize: "12px", color: "#a0aec0", fontFamily: "Manrope, sans-serif" }}>{isRTL ? "شعار علامتك التجارية" : "Your brand logo here"}</span>
            </div>
          </div>
        )}

        <div style={{ padding: "28px 36px 24px", color: "#2d3748", fontSize: "15px", lineHeight: "1.75" }}>
          <p style={{ margin: "0 0 16px", fontWeight: "600" }}>{content.greeting}</p>
          <p style={{ margin: "0 0 16px", color: "#4a5568", whiteSpace: "pre-wrap" }}>{content.hook}</p>
          <p style={{ margin: "0 0 20px", color: "#4a5568", whiteSpace: "pre-wrap" }}>{content.body}</p>
          <p style={{ margin: "0 0 28px", color: "#4a5568", whiteSpace: "pre-wrap" }}>{content.closing}</p>

          {form.bookingLink && (
            <div style={{ textAlign: "center", margin: "24px 0 28px" }}>
              <a href={form.bookingLink}
                style={{
                  display: "inline-block",
                  background: "#2d3748",
                  color: "#ffffff",
                  textDecoration: "none",
                  padding: "13px 28px",
                  borderRadius: "50px",
                  fontWeight: "600",
                  fontSize: "14px",
                  fontFamily: "Manrope, sans-serif",
                  letterSpacing: "0.3px",
                }}>
                {content.cta}
              </a>
            </div>
          )}
          {!form.bookingLink && (
            <div style={{ textAlign: "center", margin: "24px 0 28px" }}>
              <div style={{
                display: "inline-block",
                background: "#e2e8f0",
                color: "#a0aec0",
                padding: "13px 28px",
                borderRadius: "50px",
                fontSize: "13px",
                fontFamily: "Manrope, sans-serif",
                border: "1px dashed #cbd5e0"
              }}>
                {isRTL ? "← أضف رابط الحجز لعرض الزر" : "Add a booking link to show CTA →"}
              </div>
            </div>
          )}

          <p style={{ margin: "20px 0 4px", color: "#4a5568" }}>{content.signoff}</p>
          <p style={{ margin: "0 0 2px", fontWeight: "700", color: "#2d3748", fontSize: "15px" }}>{form.senderName || (isRTL ? "اسمك هنا" : "Your Name")}</p>
          <p style={{ margin: "0 0 2px", color: "#718096", fontSize: "13px" }}>{form.senderTitle || (isRTL ? "مدير الشراكات" : "Brand Partnerships")}</p>
          <p style={{ margin: "0", color: "#718096", fontSize: "13px" }}>{form.senderEmail || "hello@yourbrand.com"}</p>
        </div>

        <div style={{ padding: "14px 36px", background: "#f7fafc", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <p style={{ margin: "0", fontSize: "11px", color: "#a0aec0", fontFamily: "Manrope, sans-serif" }}>
            {isRTL
              ? "تم إرسال هذا البريد كجزء من مبادرة التواصل مع المنشئين. للإلغاء، رد بـ \"إلغاء الاشتراك\"."
              : "This email was sent as part of a creator outreach initiative. To unsubscribe, reply with \"Unsubscribe\"."}
          </p>
        </div>
      </div>
    </div>
  );
}
