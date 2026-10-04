import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { fonts, makeStyles, useTheme } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1760172287483-02d382f63a6f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { height: 260, width: "100%" },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  back: {
    position: "absolute", left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,251,242,0.85)", alignItems: "center", justifyContent: "center",
  },
  backText: { fontSize: 24, color: c.onSurface, marginTop: -2 },
  brand: { position: "absolute", left: 24, bottom: 18 },
  brandName: { fontFamily: fonts.bold, fontSize: 28, color: c.onSurface, letterSpacing: -0.5 },
  brandSub: { fontFamily: fonts.medium, fontSize: 13, color: c.onBrandTertiary, marginTop: 2 },
  body: { paddingHorizontal: 24, paddingTop: 6 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: c.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, marginTop: 4, marginBottom: 22, lineHeight: 20 },
}));

export function AuthShell({ title, subtitle, children, showBack }: { title: string; subtitle?: string; children: React.ReactNode; showBack?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} bounces={false}>
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" transition={300} />
          <LinearGradient
            colors={["rgba(255,251,242,0)", "rgba(255,251,242,0.55)", colors.surface]}
            locations={[0, 0.55, 1]}
            style={s.scrim}
          />
          {showBack && (
            <TouchableOpacity testID="auth-back-btn" style={[s.back, { top: insets.top + 10 }]} onPress={() => router.back()}>
              <Text style={s.backText}>‹</Text>
            </TouchableOpacity>
          )}
          <View style={s.brand}>
            <Text style={s.brandName}>Mandi Khata</Text>
            <Text style={s.brandSub}>Purchase • Commission • Payment Out</Text>
          </View>
        </View>
        <View style={s.body}>
          <Text style={s.title}>{title}</Text>
          {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function GoogleButton({ onPress, loading, testID }: { onPress: () => void; loading?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      style={{
        minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary, flexDirection: "row", alignItems: "center",
        justifyContent: "center", gap: 10,
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: "#4285F4" }}>G</Text>
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface }}>
        {loading ? "Google…" : "Google se login karein"}
      </Text>
    </TouchableOpacity>
  );
}
