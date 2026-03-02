"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type TempUnit = "F" | "C";
export type SnowUnit = "in" | "cm";

interface UnitContextType {
  tempUnit: TempUnit;
  setTempUnit: (u: TempUnit) => void;
  displayTemp: (temp: number | null | undefined) => string;
}

const UnitContext = createContext<UnitContextType>({
  tempUnit: "F",
  setTempUnit: () => {},
  displayTemp: (t) => (t == null ? "—" : `${Math.round(t)}°F`),
});

export function UnitProvider({ children }: { children: ReactNode }) {
  const [tempUnit, setTempUnitState] = useState<TempUnit>("F");

  useEffect(() => {
    const saved = localStorage.getItem("powdercast_tempUnit") as TempUnit;
    if (saved === "F" || saved === "C") setTempUnitState(saved);
  }, []);

  const setTempUnit = (u: TempUnit) => {
    setTempUnitState(u);
    localStorage.setItem("powdercast_tempUnit", u);
  };

  const displayTemp = (temp: number | null | undefined): string => {
    if (temp == null) return "—";
    if (tempUnit === "C") {
      const c = Math.round(((temp - 32) * 5) / 9);
      return `${c}°C`;
    }
    return `${Math.round(temp)}°F`;
  };

  return (
    <UnitContext.Provider value={{ tempUnit, setTempUnit, displayTemp }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
