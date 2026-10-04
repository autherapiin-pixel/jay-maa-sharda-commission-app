import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { fonts, makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  btn: {
    minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 10, paddingHorizontal: 18, overflow: "hidden",
  },
  btnText: { fontFamily: fonts.semibold, fontSize: 16, color: c.onBrandPrimary },
  outline: { borderWidth: 1.5, borderColor: c.brandPrimary, backgroundColor: c.surfaceSecondary },
  outlineText: { color: c.brandPrimary },
  ghost: { backgroundColor: c.surfaceTertiary },
  ghostText: { color: c.onSurface },
  danger: { borderWidth: 1, borderColor: c.error, backgroundColor: c.surfaceSecondary },
  dangerText: { color: c.error },

  field: { marginBottom: 14 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: c.muted, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: c.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "web" ? 13 : 12,
    fontSize: 16, color: c.onSurface, fontFamily: fonts.regular, minHeight: 50,
  },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 5 },
  errorText: { fontFamily: fonts.medium, fontSize: 12, color: c.error, marginTop: 5 },

  card: {
    backgroundColor: c.surfaceSecondary, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: c.border,
    ...Platform.select({
      web: { boxShadow: "0 4px 18px rgba(28,25,23,0.06)" } as any,
      default: { shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    }),
  },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  chipText: { fontFamily: fonts.semibold, fontSize: 11.5 },
}));

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger" | "whatsapp";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  haptic?: boolean;
};

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, style, testID, haptic = true }: BtnProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const press = () => {
    if (haptic && Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };
  const inner = (
    <>
      {loading ? <ActivityIndicator color={variant === "primary" || variant === "whatsapp" ? colors.onBrandPrimary : colors.brandPrimary} /> : icon}
      <Text
        style={[
          s.btnText,
          variant === "outline" && s.outlineText,
          variant === "ghost" && s.ghostText,
          variant === "danger" && s.dangerText,
        ]}
      >
        {title}
      </Text>
    </>
  );
  if (variant === "primary") {
    return (
      <TouchableOpacity testID={testID} onPress={press} disabled={disabled || loading} activeOpacity={0.85} style={[{ opacity: disabled ? 0.6 : 1 }, style]}>
        <LinearGradient colors={[colors.brandGradientStart, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      testID={testID}
      onPress={press}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        s.btn,
        variant === "outline" && s.outline,
        variant === "ghost" && s.ghost,
        variant === "danger" && s.danger,
        variant === "whatsapp" && { backgroundColor: colors.whatsapp },
        { opacity: disabled ? 0.6 : 1 },
        style,
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
}

type FieldProps = TextInputProps & { label?: string; helper?: string; error?: string; testID?: string };

export function Field({ label, helper, error, style, ...rest }: FieldProps) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.field}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted} style={[s.input, error && { borderColor: colors.error }, style]} {...rest} />
      {!!error ? <Text style={s.errorText}>{error}</Text> : !!helper && <Text style={s.helper}>{helper}</Text>}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function StatusChip({ status, label, testID }: { status: "paid" | "partial" | "pending"; label?: string; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const map = {
    paid: { bg: colors.successSoft, fg: colors.onSuccessSoft, text: "✓ Paid" },
    partial: { bg: colors.infoSoft, fg: colors.onInfoSoft, text: "Partial" },
    pending: { bg: colors.warningSoft, fg: colors.onWarningSoft, text: "बाकी" },
  }[status];
  return (
    <View testID={testID} style={[s.chip, { backgroundColor: map.bg }]}>
      <Text style={[s.chipText, { color: map.fg }]}>{label ?? map.text}</Text>
    </View>
  );
}

export function money(v: number | undefined | null) {
  return "₹" + Math.round(v || 0).toLocaleString("en-IN");
}

export function invoiceStatus(inv: { paid?: boolean; paid_amount?: number }): "paid" | "partial" | "pending" {
  if (inv.paid) return "paid";
  if ((inv.paid_amount || 0) > 0) return "partial";
  return "pending";
}
