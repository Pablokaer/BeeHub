"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

/**
 * Switches between the day and night themes. Both labels are rendered and CSS shows the one
 * that matches <html data-theme>, so server and client markup agree and nothing flashes.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next: Theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this page only.
    }
  }
  return (
    <button type="button" onClick={toggle} className="cm-header-button cm-theme-toggle" data-testid="theme-toggle">
      <span className="cm-theme-to-dark">
        <Moon className="size-4" aria-hidden />
        <span className="cm-theme-label">Night</span>
        <span className="sr-only"> theme</span>
      </span>
      <span className="cm-theme-to-light">
        <Sun className="size-4" aria-hidden />
        <span className="cm-theme-label">Day</span>
        <span className="sr-only"> theme</span>
      </span>
    </button>
  );
}
