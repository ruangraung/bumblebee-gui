import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";

const TITLES: Record<string, string> = {
  "/": "dashboard",
  "/scan": "scan",
  "/results": "results",
  "/findings": "findings",
  "/settings": "settings",
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "bumblebee";

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
          <p className="font-mono text-xs text-muted-foreground">
            Bumblebee GUI<span className="text-muted-foreground/50"> / </span>
            <span className="text-foreground">{title}</span>
          </p>
          <ThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
