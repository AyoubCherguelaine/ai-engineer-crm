"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? `Switch to ${dark ? "light" : "dark"} mode`
    : "Change color theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("icon-button theme-toggle", className)}
      title={label}
      aria-label={label}
      disabled={!mounted}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
