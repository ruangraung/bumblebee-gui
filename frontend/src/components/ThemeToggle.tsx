import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  // Dark-mode-first: default to dark unless the user explicitly chose light.
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setIsDark((d) => !d)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}
