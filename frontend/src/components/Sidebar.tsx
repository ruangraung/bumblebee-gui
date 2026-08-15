import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Scan,
  Table,
  AlertTriangle,
  Settings,
  Bug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/scan", label: "Scan", icon: Scan },
  { to: "/results", label: "Results", icon: Table },
  { to: "/findings", label: "Findings", icon: AlertTriangle },
];

const bottomItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bug className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Bumblebee GUI</p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            A web UI for the Bumblebee supply-chain scanner
          </p>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="overline mb-2 px-3">Workspace</p>
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Bottom nav + version */}
      <div className="border-t border-border px-3 py-3">
        <p className="overline mb-2 px-3">System</p>
        {bottomItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <p className="mt-4 px-3 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
          gui v0.1.0 · cli v0.1.1
        </p>
      </div>
    </aside>
  );
}
