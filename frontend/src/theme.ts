// Design tokens — warm Indian fruit-market invoice aesthetic.
// Cream canvas, deep amber brand, green header, blue table rows (matching
// the physical invoice format the user shared).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces — cream canvas, pure white lifted cards
  surface: "#FFFBF2",
  onSurface: "#1C1917",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1917",
  surfaceTertiary: "#F5EAD4",
  onSurfaceTertiary: "#292524",
  surfaceInverse: "#1C1917",
  onSurfaceInverse: "#FFFBF2",
  muted: "#78716C",

  // Brand — deep amber / bazaar orange
  brand: "#D97706",
  onBrand: "#FFFFFF",
  brandPrimary: "#D97706",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FEF3C7",
  onBrandTertiary: "#92400E",
  brandGradientStart: "#F59E0B",
  brandGradientEnd: "#B45309",

  // Status (text-safe) + soft chip backgrounds
  success: "#15803D",
  onSuccess: "#FFFFFF",
  successSoft: "#DCFCE7",
  onSuccessSoft: "#166534",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  warningSoft: "#FEF3C7",
  onWarningSoft: "#92400E",
  error: "#DC2626",
  onError: "#FFFFFF",
  errorSoft: "#FEE2E2",
  onErrorSoft: "#991B1B",
  info: "#0F4A6F",
  onInfo: "#FFFFFF",
  infoSoft: "#CFE7F6",
  onInfoSoft: "#0F4A6F",
  whatsapp: "#25D366",
  onWhatsapp: "#FFFFFF",

  // Invoice specific tones (match the paper invoice photo)
  invoiceHeader: "#F59E0B", // top orange band
  onInvoiceHeader: "#1C1917",
  invoiceGreen: "#86C33B", // green sub-header band
  invoiceTableHead: "#111111",
  onInvoiceTableHead: "#FFFFFF",
  invoiceTableRow: "#CFE7F6", // light blue values column
  invoiceTotalRow: "#F4B678",
  invoiceNetRow: "#FFEF00",

  // Lines
  border: "#EDE6D6",
  borderStrong: "#D6CDB8",
  divider: "#EDE6D6",
  shadow: "#1C1917",
};

export const fonts = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
};

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
