"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LabController } from "./use-lab-controller";

const LabControllerContext = createContext<LabController | null>(null);

export function LabControllerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LabController;
}) {
  return (
    <LabControllerContext.Provider value={value}>
      {children}
    </LabControllerContext.Provider>
  );
}

export function useLabControllerContext() {
  const controller = useContext(LabControllerContext);
  if (!controller) {
    throw new Error(
      "Lab components must be rendered inside LabControllerProvider",
    );
  }
  return controller;
}
