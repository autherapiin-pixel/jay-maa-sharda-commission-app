import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { AuthShell } from "@/src/components/auth-shell";
import { Button, Card, Field } from "@/src/components/ui";
import { fonts, useTheme } from "@/src/theme";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    if (!identifier.trim()) return setError("Email ya mobile number daalein");
    setBusy(true);
    setError("");
    try {
      const r = await api.forgotPassword(identifier.trim());
      setSentTo(r.email_hint || "aapke email");
    } catch (e: any) {
      setError(e?.message || "Request fail hui");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Password bhool gaye?" subtitle="Email ya mobile daalein — hum reset link email par bhejenge" showBack>
      {sentTo ? (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <Text testID="forgot-success" style={{ fontFamily: fonts.semibold, color: colors.onSuccessSoft, fontSize: 16 }}>
            ✓ Reset link bhej di gayi
          </Text>
          <Text style={{ fontFamily: fonts.regular, color: colors.onSuccessSoft, marginTop: 6, lineHeight: 20 }}>
            {sentTo} par email check karein (Spam folder bhi). Link 30 minute tak valid hai.
          </Text>
          <Button title="Login par wapas" variant="outline" onPress={() => router.replace("/(auth)/login")} style={{ marginTop: 16 }} />
        </Card>
      ) : (
        <View>
          <Field
            testID="forgot-identifier"
            label="Email ya Mobile number"
            placeholder="9876543210 ya aap@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
            error={error}
            onSubmitEditing={submit}
          />
          <Button testID="forgot-submit" title="Reset link bhejein" onPress={submit} loading={busy} />
        </View>
      )}
    </AuthShell>
  );
}
