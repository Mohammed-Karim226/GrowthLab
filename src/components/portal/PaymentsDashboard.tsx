"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Check,
  CircleDollarSign,
  Clock3,
  Crown,
  Gem,
  Layers3,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import type { AccountRow, ClientPaymentPlanRow, PaymentStatus } from "@/types/database";
import type { Locale } from "@/lib/i18n";
import { directionOf } from "@/lib/i18n";
import { formatDate, formatNumber } from "@/lib/format";

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: "#55dcb1",
  pending: "#dec378",
  overdue: "#ef9371",
  waived: "#9f99f4",
};

const FEATURE_ICONS = [Layers3, Sparkles, TrendingUp, BarChart3] as const;

function money(value: number | null, currency: string, locale: Locale) {
  if (value === null) return "—";
  return `${formatNumber(value, locale, { maximumFractionDigits: 2 })} ${currency}`;
}

export default function PaymentsDashboard({
  payments,
  accounts,
  locale,
}: {
  payments: ClientPaymentPlanRow[];
  accounts: AccountRow[];
  locale: Locale;
}) {
  const t = useTranslations("portal.paymentDetails");
  const tPayments = useTranslations("portal.payments");
  const activeAccounts = accounts.filter((account) => account.stage?.toLowerCase() !== "inactive");
  const latest = payments[0] ?? null;
  const currency = latest?.currency ?? "USD";
  const planMultiplier = Math.max(1, Math.ceil(activeAccounts.length / 4));

  const chartData = useMemo(
    () =>
      [...payments].reverse().map((payment) => ({
        label: new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(
          new Date(`${payment.billing_month.slice(0, 10)}T00:00:00Z`)
        ),
        amount: Number(payment.amount),
        total: payment.total_plan_price === null ? null : Number(payment.total_plan_price),
      })),
    [locale, payments]
  );

  const statusData = (Object.keys(STATUS_COLORS) as PaymentStatus[])
    .map((status) => ({ status, value: payments.filter((payment) => payment.status === status).length }))
    .filter((item) => item.value > 0);
  const paidTotal = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstanding = payments
    .filter((payment) => payment.status === "pending" || payment.status === "overdue")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const settledPayments = payments.filter((payment) => payment.status === "paid" || payment.status === "waived").length;
  const paymentHealth = payments.length ? Math.round((settledPayments / payments.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="portal-hero portal-reveal relative overflow-hidden rounded-[30px] border border-[#d8be78]/20 px-6 py-8 sm:px-9 sm:py-10">
        <div aria-hidden className="portal-hero-grid absolute inset-0 opacity-60" />
        <div aria-hidden className="absolute -end-20 -top-24 size-72 rounded-full bg-[#9f99f4]/15 blur-[90px]" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d8be78]/25 bg-[#d8be78]/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#ead69e] uppercase">
              <Crown className="size-3.5" aria-hidden /> {t("eyebrow")}
            </span>
            <h1 className="mt-5 font-satoshi text-3xl tracking-[-0.045em] text-[#f6f2e9] sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#95918a]">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-black/20 p-3 pe-5 backdrop-blur-xl">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-[#9f99f4]/20 bg-[#9f99f4]/10 text-[#c3beff]"><Gem className="size-5" /></span>
            <div><p className="text-[9px] tracking-[0.16em] text-[#77766f] uppercase">{t("planLabel")}</p><p className="mt-1 font-satoshi text-lg text-white">{t("basicPlan")}</p></div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("currentTotal"), value: money(latest?.total_plan_price ?? latest?.amount ?? null, currency, locale), icon: CircleDollarSign, tone: "#dec378" },
          { label: t("paidToDate"), value: money(paidTotal, currency, locale), icon: ShieldCheck, tone: "#55dcb1" },
          { label: t("outstanding"), value: money(outstanding, currency, locale), icon: Clock3, tone: "#ef9371" },
          { label: t("managedAccounts"), value: formatNumber(activeAccounts.length, locale), icon: Users, tone: "#9f99f4" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="portal-glass-panel rounded-[24px] border border-white/[0.075] p-4 sm:p-5">
            <span className="flex size-10 items-center justify-center rounded-[14px] border border-white/[0.07]" style={{ color: tone, backgroundColor: `${tone}12` }}><Icon className="size-4.5" /></span>
            <p className="mt-4 text-[9px] font-semibold tracking-[0.15em] text-[#77766f] uppercase">{label}</p>
            <p className="mt-1 font-satoshi text-2xl tracking-[-0.04em] text-[#f4f0e7]">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="portal-chart-card overflow-hidden rounded-[28px] border border-white/[0.075] p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-[14px] border border-[#d8be78]/15 bg-[#d8be78]/[0.07] text-[#d9bf77]"><TrendingUp className="size-4" /></span><div><h2 className="font-satoshi text-xl text-[#f4f1e9]">{t("chartTitle")}</h2><p className="mt-1 text-[11px] text-[#77766f]">{t("chartHint")}</p></div></div>
          {chartData.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-white/[0.08] px-4 py-16 text-center text-sm text-[#77766f]">{t("empty")}</p> : (
            <div className="mt-6 h-72 rounded-[20px] border border-white/[0.055] bg-black/15 p-2">
              <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 14, bottom: 0, left: 0 }}><defs><linearGradient id="paymentArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dec378" stopOpacity={0.35}/><stop offset="100%" stopColor="#dec378" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 8"/><XAxis dataKey="label" reversed={directionOf(locale) === "rtl"} tick={{ fill: "#77766f", fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis orientation={directionOf(locale) === "rtl" ? "right" : "left"} tick={{ fill: "#77766f", fontSize: 10 }} tickLine={false} axisLine={false} width={44}/><Tooltip contentStyle={{ background: "#11120f", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14 }} formatter={(value) => money(Number(value), currency, locale)}/><Area type="monotone" dataKey="amount" name={t("installmentSeries")} stroke="#dec378" strokeWidth={3} fill="url(#paymentArea)"/><Area type="monotone" dataKey="total" name={t("planSeries")} stroke="#9f99f4" strokeWidth={2} fill="transparent" connectNulls/></AreaChart></ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="portal-chart-card relative overflow-hidden rounded-[28px] border border-[#9f99f4]/15 p-5 sm:p-6">
          <div aria-hidden className="absolute -end-20 top-12 size-64 rounded-full bg-[#9f99f4]/[0.08] blur-[80px]" />
          <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-[14px] border border-[#9f99f4]/15 bg-[#9f99f4]/[0.07] text-[#bdb8ff]"><ReceiptText className="size-4" /></span><div><h2 className="font-satoshi text-xl text-[#f4f1e9]">{t("statusTitle")}</h2><p className="mt-1 text-[11px] text-[#77766f]">{t("statusHint")}</p></div></div>
          {statusData.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-white/[0.08] px-4 py-16 text-center text-sm text-[#77766f]">{t("empty")}</p> : <div className="relative mt-5 space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-semibold tracking-[0.16em] text-[#77766f] uppercase">{t("completionLabel")}</p><p className="mt-1 font-satoshi text-3xl text-white">{formatNumber(paymentHealth, locale)}<span className="text-base text-[#aaa4ed]">%</span></p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[9px] text-[#aaa79e]"><Sparkles className="size-3 text-[#d8be78]" />{t("recordsTracked", { count: payments.length })}</span></div>
              <div className="mt-4 flex h-4 w-full gap-1 overflow-hidden rounded-full bg-white/[0.055]" role="img" aria-label={t("statusHint")}>{statusData.map((item) => <div key={item.status} className="h-full min-w-1 transition-all duration-700 first:rounded-s-full last:rounded-e-full" style={{ width: `${(item.value / payments.length) * 100}%`, background: `linear-gradient(90deg, ${STATUS_COLORS[item.status]}99, ${STATUS_COLORS[item.status]})`, boxShadow: `0 0 16px ${STATUS_COLORS[item.status]}55` }} />)}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {statusData.map((item) => {
                const percentage = payments.length ? (item.value / payments.length) * 100 : 0;
                return <div key={item.status} className="rounded-2xl border border-white/[0.065] bg-white/[0.028] p-3.5 transition-colors hover:bg-white/[0.045]"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg" style={{ color: STATUS_COLORS[item.status], backgroundColor: `${STATUS_COLORS[item.status]}14` }}><span className="size-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: STATUS_COLORS[item.status] }} /></span><span className="text-xs font-medium text-[#c9c5bc]">{tPayments(`status.${item.status}` as never)}</span><span className="ms-auto font-satoshi text-lg text-white">{formatNumber(item.value, locale)}</span></div><p className="mt-1 ps-9 text-[10px] text-[#77766f]">{percentage.toFixed(0)}%</p></div>;
              })}
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[#d8be78]/12 bg-[#d8be78]/[0.045] px-3.5 py-3"><span className="text-[10px] tracking-[0.12em] text-[#8f897a] uppercase">{t("latestStatus")}</span>{latest && <span className="rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase" style={{ color: STATUS_COLORS[latest.status], borderColor: `${STATUS_COLORS[latest.status]}35`, backgroundColor: `${STATUS_COLORS[latest.status]}10` }}>{tPayments(`status.${latest.status}` as never)}</span>}</div>
          </div>}
        </article>
      </section>

      <section className="portal-feature-gateway relative overflow-hidden rounded-[30px] border border-[#8f78e8]/20 bg-[#110f26]/45 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.2em] text-[#d8be78] uppercase"><Crown className="size-3.5" />{t("includedEyebrow")}</p><h2 className="mt-2 font-satoshi text-2xl text-[#f4f0e7] sm:text-3xl">{t("includedTitle")}</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#9992b2]">{t("includedHint")}</p></div><div className="rounded-2xl border border-[#d8be78]/20 bg-[#d8be78]/[0.07] px-4 py-3"><p className="text-[9px] tracking-[0.15em] text-[#a9986b] uppercase">{t("accountRule")}</p><p className="mt-1 text-sm font-medium text-[#ead69e]">{activeAccounts.length <= 4 ? t("baseAccountIncluded") : planMultiplier === 2 ? t("doublePlan", { count: activeAccounts.length }) : t("scaledPlan", { count: activeAccounts.length, multiplier: planMultiplier })}</p></div></div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{FEATURE_ICONS.map((Icon, index) => <article key={index} className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4"><span className="flex size-9 items-center justify-center rounded-xl bg-[#9f99f4]/10 text-[#c3beff]"><Icon className="size-4" /></span><h3 className="mt-4 text-sm font-medium text-[#efebe3]">{t(`features.${index}.title` as never)}</h3><p className="mt-2 text-[11px] leading-relaxed text-[#85817d]">{t(`features.${index}.description` as never)}</p></article>)}</div>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#54d8ac]/15 bg-[#54d8ac]/[0.05] p-4"><Check className="mt-0.5 size-4 shrink-0 text-[#67ddb5]"/><p className="text-xs leading-relaxed text-[#a8b9b2]">{t("pricingNote")}</p></div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/[0.075] bg-black/10">
        <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6"><h2 className="font-satoshi text-xl text-[#f4f1e9]">{t("historyTitle")}</h2><p className="mt-1 text-[11px] text-[#77766f]">{t("historyHint")}</p></div>
        {payments.length === 0 ? <p className="px-5 py-14 text-center text-sm text-[#77766f]">{t("empty")}</p> : <div className="divide-y divide-white/[0.06]">{payments.map((payment) => <article key={payment.id} className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[1.1fr_1fr_1fr_1fr_auto] lg:items-center"><div><p className="text-[9px] tracking-[0.13em] text-[#77766f] uppercase">{t("billingMonth")}</p><p className="mt-1 text-sm text-white">{formatDate(payment.billing_month, locale)}</p></div><div><p className="text-[9px] tracking-[0.13em] text-[#77766f] uppercase">{t("installmentSeries")}</p><p className="mt-1 text-sm font-semibold text-[#ead69e]">{money(payment.amount, payment.currency, locale)}</p></div><div><p className="text-[9px] tracking-[0.13em] text-[#77766f] uppercase">{t("planSeries")}</p><p className="mt-1 text-sm text-[#c3beff]">{money(payment.total_plan_price, payment.currency, locale)}</p></div><div><p className="text-[9px] tracking-[0.13em] text-[#77766f] uppercase">{tPayments("dueDate")}</p><p className="mt-1 text-sm text-[#cac6bc]">{formatDate(payment.due_date, locale)}</p></div><span className="w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase" style={{ color: STATUS_COLORS[payment.status], borderColor: `${STATUS_COLORS[payment.status]}35`, backgroundColor: `${STATUS_COLORS[payment.status]}10` }}>{tPayments(`status.${payment.status}` as never)}</span>{payment.notes && <p className="text-xs leading-relaxed text-[#85817d] lg:col-span-5">{payment.notes}</p>}</article>)}</div>}
      </section>
    </div>
  );
}
