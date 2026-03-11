"use client";

import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useCountUp } from "@/hooks/use-count-up";

const stats = [
  { end: 80, suffix: "%", label: "menej manualnej prace" },
  { end: 10, suffix: "x", label: "rychlejsie spracovanie" },
  { end: 0, suffix: "", label: "pristup k datam", display: "24/7" },
  { end: 100, suffix: "%", label: "bezpecnost dat" },
];

function StatItem({
  stat,
  isVisible,
}: {
  stat: (typeof stats)[number];
  isVisible: boolean;
}) {
  const count = useCountUp(stat.end, 2000, isVisible);
  return (
    <div className="text-center py-6 px-4">
      <div className="text-4xl sm:text-5xl font-extrabold text-primary mb-2">
        {stat.display ?? `${count}${stat.suffix}`}
      </div>
      <div className="text-sm text-muted-foreground font-medium">
        {stat.label}
      </div>
    </div>
  );
}

export function StatsBar() {
  const { ref, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({ threshold: 0.3 });
  return (
    <section ref={ref} className="border-y border-border bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
          {stats.map((stat) => (
            <StatItem
              key={stat.label}
              stat={stat}
              isVisible={isIntersecting}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
