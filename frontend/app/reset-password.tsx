import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { AuthShell } from "@/src/components/auth-shell";
import { Button, Card, Field } from "@/src/components/ui";
import { fonts, useTheme } from "@/src/theme";

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { applyAuth } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!token) return setError("Reset link adhoora hai — email se dobara kholen");
    if (password.length < 6) return setError("Password kam se kam 6 akshar ka ho");
    if (password !== confirm) return setError("Dono password same nahi hain");
    setBusy(true);
    try {
      const r = await api.resetPassword(token, password);
      await applyAuth(r);
    } catch (e: any) {
      setError(e?.message || "Reset fail hua");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Naya password" subtitle="Naya password set karein — iske baad aap seedha login ho jaayenge">
      {!token ? (
        <Card style={{ backgroundColor: colors.errorSoft, borderColor: colors.errorSoft }}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.onErrorSoft }}>Link galat hai ya token missing hai.</Text>
          <Button title="Dobara request karein" variant="outline" onPress={() => router.replace("/(auth)/forgot-password")} style={{ marginTop: 14 }} />
        </Card>
      ) : (
        <>
          <Field testID="reset-password" label="Naya password" placeholder="kam se kam 6 akshar" secureTextEntry value={password} onChangeText={setPassword} />
          <Field testID="reset-confirm" label="Password dobara" placeholder="••••••••" secureTextEntry value={confirm} onChangeText={setConfirm} error={error} onSubmitEditing={submit} />
          <Button testID="reset-submit" title="Password badlein" onPress={submit} loading={busy} />
        </>
      )}
    </AuthShell>
  );
}
