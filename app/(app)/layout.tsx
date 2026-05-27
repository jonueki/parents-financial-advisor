import Link from "next/link";
import { DollarSign, Target, TrendingUp, Settings } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t bg-background z-40">
        <div className="flex justify-around items-center h-16 max-w-xl mx-auto">
          <NavItem href="/budget" icon={<DollarSign className="h-6 w-6" />} label="Budget" />
          <NavItem href="/goals" icon={<Target className="h-6 w-6" />} label="Goals" />
          <NavItem href="/net-worth" icon={<TrendingUp className="h-6 w-6" />} label="Net Worth" />
          <NavItem href="/settings" icon={<Settings className="h-6 w-6" />} label="Settings" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[56px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
