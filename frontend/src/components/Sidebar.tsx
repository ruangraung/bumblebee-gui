import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Scan,
  Table,
  AlertTriangle,
  Settings,
  Bug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: Scan },
  { to: "/results", label: "Results", icon: Table },
  { to: "/findings", label: "Findings", icon: AlertTriangle },
];

const bottomItems = [
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo / Title */}
      <div className="flex items-center gap-2 px-6 py-4">
        <Bug className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Bumblebee GUI</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border px-3 py-4">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
