"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read currently applied theme from DOM attribute or localStorage
    try {
      const currentTheme = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
      if (currentTheme === "dark" || currentTheme === "light") {
        setTheme(currentTheme);
      } else {
        const stored = localStorage.getItem("sarathi_theme") as "light" | "dark" | null;
        if (stored) {
          setTheme(stored);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          setTheme("dark");
        }
      }
    } catch {
      // Ignore if localStorage unavailable
    }

    // Listen for OS system preference changes if no manual preference stored
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleMediaChange(e: MediaQueryListEvent) {
      try {
        if (!localStorage.getItem("sarathi_theme")) {
          const newTheme = e.matches ? "dark" : "light";
          setTheme(newTheme);
          document.documentElement.setAttribute("data-theme", newTheme);
          if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      } catch {
        // Ignore
      }
    }
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      document.documentElement.setAttribute("data-theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("sarathi_theme", nextTheme);
    } catch {
      // Ignore
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {mounted && isDark ? (
        // Sun icon for switching to light
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="theme-icon sun-icon"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon icon for switching to dark
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="theme-icon moon-icon"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
