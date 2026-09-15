// src/contexts/ThemeContext.tsx
//
// This is the ONLY new logic you need. It does one thing:
// sets data-theme="light" | "dark" | "modern" on <html>.
// The CSS in variables.scss handles the rest — no ion-* component
// anywhere in your app needs to know a theme system exists.

import React, { createContext, useContext, useEffect, useState } from "react";
// No extra package needed — plain localStorage works fine in both the
// browser and inside a Capacitor WebView, so this avoids the
// @capacitor/preferences ERESOLVE conflict entirely.
// (If you later want native-secure storage, swap the two localStorage
// lines below for @capacitor/preferences' get/set once your dependency
// versions are aligned.)

export type LinkUpTheme = "light" | "dark" | "modern";

interface ThemeContextValue {
  theme: LinkUpTheme;
  setTheme: (theme: LinkUpTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "linkup-theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<LinkUpTheme>("light");

  // Load saved preference on app start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "modern") {
      applyTheme(saved as LinkUpTheme);
    } else {
      // No saved preference — default to system dark/light, ignore for 'modern'
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  const applyTheme = (next: LinkUpTheme) => {
    document.documentElement.setAttribute("data-theme", next);
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useLinkUpTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useLinkUpTheme must be used within a ThemeProvider");
  return ctx;
};

/* ==========================================================
   USAGE

   1. Wrap your app once, in App.tsx:

      import { ThemeProvider } from './contexts/ThemeContext';

      const App: React.FC = () => (
        <ThemeProvider>
          <IonApp>
            ...your existing routes/components, completely unchanged...
          </IonApp>
        </ThemeProvider>
      );

   2. Anywhere you want a theme switcher (e.g. Settings page):

      import { useLinkUpTheme } from '../contexts/ThemeContext';
      import { IonSegment, IonSegmentButton, IonLabel } from '@ionic/react';

      const ThemeSwitcher: React.FC = () => {
        const { theme, setTheme } = useLinkUpTheme();
        return (
          <IonSegment
            value={theme}
            onIonChange={(e) => setTheme(e.detail.value as any)}
          >
            <IonSegmentButton value="light"><IonLabel>Light</IonLabel></IonSegmentButton>
            <IonSegmentButton value="dark"><IonLabel>Dark</IonLabel></IonSegmentButton>
            <IonSegmentButton value="modern"><IonLabel>Modern</IonLabel></IonSegmentButton>
          </IonSegment>
        );
      };

   That's it. Every ion-button, ion-card, ion-toolbar, ion-item,
   your chat bubbles, everything — already reads the CSS variables
   at paint time, so they instantly reflect the new theme.
   No prop drilling, no conditional rendering, no re-fetching data.
   ========================================================== */
