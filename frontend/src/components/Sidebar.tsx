import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Scan,
  Table,
  AlertTriangle,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES, type RouteEntry } from "@/lib/routes";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/scan": Scan,
  "/results": Table,
  "/findings": AlertTriangle,
  "/settings": Settings,
};

const navItems = ROUTES.filter((route) => route.path !== "/settings");
const bottomItems = ROUTES.filter((route) => route.path === "/settings");

function NavItem({ route }: { route: RouteEntry }) {
  const Icon = ICONS[route.path];
  return (
    <NavLink
      to={route.path}
      end={route.path === "/"}
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
      {route.label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        {/* Empty alt on purpose: the brand name sits right beside it, so a label
            here would be announced twice. */}
        <img src="/bumblebee.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Bumblebee GUI</p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            A web UI for the Bumblebee supply-chain scanner
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="overline mb-2 px-3">Workspace</p>
        {navItems.map((route) => (
          <NavItem key={route.path} route={route} />
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <p className="overline mb-2 px-3">System</p>
        {bottomItems.map((route) => (
          <NavItem key={route.path} route={route} />
        ))}
        <p className="mt-4 px-3 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
          gui v0.1.0 · cli v0.1.2
        </p>
      </div>
    </aside>
  );
}
