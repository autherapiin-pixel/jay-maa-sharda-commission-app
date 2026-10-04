import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, Text, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/src/auth-context";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { fonts, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

const PUBLIC_SEGMENTS = new Set(["(auth)", "reset-password"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const isPublic = !!first && PUBLIC_SEGMENTS.has(first);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) router.replace("/(auth)/login");
    else if (user && (isPublic || !first)) router.replace("/(tabs)");
  }, [loading, user, isPublic, first]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {loading && (
        <View
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
          }}
        >
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={{ marginTop: 12, color: colors.muted, fontFamily: fonts.medium }}>Mandi Khata</Text>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [fonts.regular]: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    [fonts.medium]: require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    [fonts.semibold]: require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    [fonts.bold]: require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
  });
  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <AuthGate>
                <Stack screenOptions={{ headerShown: false }} />
              </AuthGate>
            </AuthProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
