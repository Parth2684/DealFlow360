"use client";

import type { OrganizationFormatting } from "@repo/common";
import { createContext, useContext, type ReactNode } from "react";

const OrganizationFormattingContext =
  createContext<OrganizationFormatting | null>(null);

export function OrganizationFormattingProvider({
  children,
  formatting,
}: {
  children: ReactNode;
  formatting: OrganizationFormatting;
}) {
  return (
    <OrganizationFormattingContext.Provider value={formatting}>
      {children}
    </OrganizationFormattingContext.Provider>
  );
}

export function useOrganizationFormatting(): OrganizationFormatting {
  const formatting = useContext(OrganizationFormattingContext);
  if (formatting === null) {
    throw new Error(
      "Organization formatting is unavailable outside the internal workspace",
    );
  }
  return formatting;
}
