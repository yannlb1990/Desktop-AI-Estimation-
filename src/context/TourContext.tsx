import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "metricore_tour_enabled";

interface TourContextValue {
  tourEnabled: boolean;
  toggleTour: () => void;
}

const TourContext = createContext<TourContextValue>({ tourEnabled: false, toggleTour: () => {} });

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [tourEnabled, setTourEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  const toggleTour = () => {
    setTourEnabled(v => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <TourContext.Provider value={{ tourEnabled, toggleTour }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);
