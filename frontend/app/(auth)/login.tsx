import { Link } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { AuthShell, GoogleButton } from "@/src/components/auth-shell";
import { Button, Field } from "@/src/components/ui";
import { fonts, useTheme } from "@/src/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { applyAuth, signInWithGoogle, googleBusy } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!identifier.trim() || !password) {
      setError("Email/mobile aur password dono daalein");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.login(identifier.trim(), password);
      await applyAuth(r);
    } catch (e: any) {
      setError(e?.message || "Login fail hua");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="नमस्ते 👋" subtitle="Apne khate me login karein — Gmail ya mobile number se">
      <GoogleButton testID="google-login-btn" onPress={signInWithGoogle} loading={googleBusy} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontFamily: fonts.medium, color: colors.muted, fontSize: 12 }}>YA</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Field
        testID="login-identifier"
        label="Email ya Mobile number"
        placeholder="9876543210 ya aap@gmail.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={identifier}
        onChangeText={setIdentifier}
      />
      <Field
        testID="login-password"
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        error={error}
      />
      <Link href="/(auth)/forgot-password" asChild>
        <TouchableOpacity testID="forgot-link" style={{ alignSelf: "flex-end", marginTop: -6, marginBottom: 18, paddingVertical: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.brandPrimary, fontSize: 13 }}>Password bhool gaye?</Text>
        </TouchableOpacity>
      </Link>

      <Button testID="login-submit" title="Login karein" onPress={submit} loading={busy} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 22, gap: 6 }}>
        <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>Naya account?</Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity testID="register-link">
            <Text style={{ fontFamily: fonts.semibold, color: colors.brandPrimary }}>Register karein</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </AuthShell>
  );
}
