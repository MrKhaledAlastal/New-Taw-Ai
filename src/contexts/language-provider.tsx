"use client";

import type { ReactNode } from "react";
import { createContext, useState, useEffect, useMemo } from "react";
import { translations } from "@/lib/translations";

type Language = "en" | "ar";
type Direction = "ltr" | "rtl";

interface LanguageContextType {
  lang: Language;
  t: (typeof translations)["en"];
  dir: Direction;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("en");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedLang = localStorage.getItem("language") as Language | null;
    if (storedLang && ["en", "ar"].includes(storedLang)) {
      setLang(storedLang);
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("language", lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang, isMounted]);

  const setLanguage = (newLang: Language) => {
    if (newLang === lang) return;
    localStorage.setItem("language", newLang);
    window.location.reload();
  };

  const value = useMemo(() => {
    const dir: Direction = lang === "ar" ? "rtl" : "ltr";
    const t = translations[lang];
    return { lang, t, dir, setLanguage };
  }, [lang]);

  if (!isMounted) {
    return null; // or a loading spinner
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
