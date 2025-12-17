"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(true);
  const [hasClicked, setHasClicked] = React.useState(false);

  React.useEffect(() => {
    const hasTheme = localStorage.getItem("chat-theme");

    if (hasTheme) {
      const timer = setTimeout(() => {
        setOpen(false);
        setHasClicked(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Tooltip
      open={open}
      onOpenChange={(newOpen) => {
        if (hasClicked) {
          setOpen(newOpen);
        }
      }}
    >
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setHasClicked(true);
            setOpen(false);
            const newTheme = theme === "dark" ? "light" : "dark";
            setTheme(newTheme);
            localStorage.setItem("chat-theme", newTheme);
          }}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] scale-110 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-10 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle dark mode</p>
      </TooltipContent>
    </Tooltip>
  );
}
