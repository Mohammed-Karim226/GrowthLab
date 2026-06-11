"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

type AnimatedCounterProps = {
  target: number;
  suffix?: string;
  duration?: number;
};

export default function AnimatedCounter({
  target,
  suffix = "",
  duration = 2000,
}: AnimatedCounterProps) {
  const locale = useLocale();
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    let start = 0;
    const step = target / (duration / 16);
    const timer = window.setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        window.clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => window.clearInterval(timer);
  }, [started, target, duration]);

  return (
    <span
      ref={ref}
      className="flex flex-col items-center text-3xl font-bold text-white"
    >
      {count.toLocaleString(locale)}
      {suffix}
    </span>
  );
}
