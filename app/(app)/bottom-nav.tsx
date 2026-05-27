"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Target, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/budget", label: "Budget", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
