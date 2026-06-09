"use client";
import { useState, useEffect } from "react";

const LS_THEME = "safetysaas_theme";

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem(LS_THEME) as "light" | "dark") || "light";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (t: "light" | "dark") => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(LS_THEME, t);
  };

  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  return { theme, toggle };
}
