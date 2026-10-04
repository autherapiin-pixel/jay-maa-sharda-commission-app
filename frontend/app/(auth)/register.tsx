import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { AuthShell, GoogleButton } from "@/src/components/auth-shell";
import { Button, Field } from "@/src/components/ui";
import { fonts, useTheme } from "@/src/theme";

const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { applyAuth, signInWithGoogle, googleBusy } = useAuth();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsRecoveryEmail = identifier.trim().length > 0 && !isEmail(identifier);

  async function submit() {
    setError("");
    if (!identifier.trim()) return setError("Email ya mobile number daalein");
    if (password.length < 6) return setError("Password kam se kam 6 akshar ka ho");
    if (password !== confirm) return setError("Dono password same nahi hain");
    if (needsRecoveryEmail && email.trim() && !isEmail(email)) return setError("Email sahi nahi hai");
    setBusy(true);
    try {
      const r = await api.register({
        identifier: identifier.trim(),
        password,
        name: name.trim() || undefined,
        email: needsRecoveryEmail && email.trim() ? email.trim() : undefined,
      });
      await applyAuth(r);
    } catch (e: any) {
      setError(e?.message || "Register fail hua");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Naya account" subtitle="Apni dukaan ka khata 1 minute me shuru karein" showBack>
      <GoogleButton testID="google-register-btn" onPress={signInWithGoogle} loading={googleBusy} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontFamily: fonts.medium, color: colors.muted, fontSize: 12 }}>YA</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Field testID="reg-name" label="Aapka naam (optional)" placeholder="Ramesh Kumar" value={name} onChangeText={setName} />
      <Field
        testID="reg-identifier"
        label="Email ya Mobile number"
        placeholder="9876543210 ya aap@gmail.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={identifier}
        onChangeText={setIdentifier}
      />
      {needsRecoveryEmail && (
        <Field
          testID="reg-email"
          label="Email (password bhoolne par reset link ke liye)"
          placeholder="aap@gmail.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          helper="Mobile se register kar rahe hain — email dene se password reset ho payega"
        />
      )}
      <Field testID="reg-password" label="Password" placeholder="kam se kam 6 akshar" secureTextEntry value={password} onChangeText={setPassword} />
      <Field testID="reg-confirm" label="Password dobara" placeholder="••••••••" secureTextEntry value={confirm} onChangeText={setConfirm} error={error} onSubmitEditing={submit} />

      <Button testID="register-submit" title="Account banayein" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
    </AuthShell>
  );
}
