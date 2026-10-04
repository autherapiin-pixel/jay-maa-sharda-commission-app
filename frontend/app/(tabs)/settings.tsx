import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  Linking,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { api, Settings } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: { fontSize: 24, fontFamily: fonts.bold, color: c.onBrandPrimary },
  subtitle: { fontSize: 12.5, fontFamily: fonts.regular, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  card: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  label: { fontSize: 12, color: c.muted, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 14,
  },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: c.brandPrimary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  status: { textAlign: "center", color: c.success, marginTop: 10 },

  // Google block
  googleBtn: {
    backgroundColor: "#4285F4",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  googleBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  googleLogo: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  googleLogoText: { color: "#4285F4", fontWeight: "900", fontSize: 13 },

  connectedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    alignSelf: "flex-start", marginBottom: 10,
  },
  connectedBadgeText: { color: "#166534", fontWeight: "700", fontSize: 12 },
  emailText: { color: c.onSurface, fontWeight: "700" },
  linkRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  linkBtn: {
    flex: 1,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: c.brandPrimary,
    borderRadius: 10,
    alignItems: "center",
  },
  linkBtnText: { color: c.brandPrimary, fontWeight: "800" },
  dangerBtn: {
    marginTop: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerBtnText: { color: c.error, fontWeight: "700" },
  helpText: { color: c.muted, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
}));

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout } = useAuth();

  const { data } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: gstatus, refetch: refetchG } = useQuery({
    queryKey: ["google-status"],
    queryFn: api.getGoogleStatus,
    refetchInterval: 5000,
  });
  const [form, setForm] = useState<Partial<Settings>>({});
  const [savedAt, setSavedAt] = useState<string>("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mut = useMutation({
    mutationFn: (d: Partial<Settings>) => api.updateSettings(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => api.disconnectGoogle(),
    onSuccess: () => refetchG(),
  });

  const [syncAllMsg, setSyncAllMsg] = useState<string>("");
  const syncAllMut = useMutation({
    mutationFn: () => api.syncAll(),
    onSuccess: (r) => {
      setSyncAllMsg(`${r.synced}/${r.total} synced`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      refetchG();
      setTimeout(() => setSyncAllMsg(""), 4000);
    },
  });

  const [importMessage, setImportMessage] = useState("");
  const importMut = useMutation({
    mutationFn: (form: FormData) => api.importExcel(form),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setImportMessage(
        `${result.invoices_imported} bills imported; ${result.invoices_skipped} already imported.`,
      );
      const warningText = result.warnings.slice(0, 5).join("\n");
      Alert.alert(
        "Excel import complete",
        [
          `${result.parties_created} parties created`,
          `${result.invoices_imported} invoices imported`,
          `${result.invoices_skipped} duplicates skipped`,
          result.warnings.length ? `Warnings:\n${warningText}` : "",
        ].filter(Boolean).join("\n"),
      );
    },
    onError: (error) => {
      Alert.alert("Excel import failed", error instanceof Error ? error.message : "Please try again.");
    },
  });

  async function chooseExcelWorkbook() {
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;

      const asset = selection.assets[0];
      const form = new FormData();
      if (Platform.OS === "web" && asset.file) {
        form.append("file", asset.file);
      } else {
        const nativeForm = form as FormData & {
          append(name: string, value: { uri: string; name: string; type: string }): void;
        };
        nativeForm.append("file", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
      importMut.mutate(form);
    } catch (error) {
      Alert.alert("Excel import failed", error instanceof Error ? error.message : "Could not open the selected file.");
    }
  }

  async function connectGoogle() {
    const url = api.googleLoginUrl();
    if (Platform.OS === "web") {
      // open in same tab so cookies carry over
      window.location.href = url;
      return;
    }
    await WebBrowser.openBrowserAsync(url);
    // When they come back, refetch
    setTimeout(() => refetchG(), 1500);
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.brandGradientStart, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>दुकान की जानकारी, कमीशन और Google sync</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Purane Excel bills import karein</Text>
          <Text style={styles.helpText}>
            Party-wise sheets wali .xlsx workbook chunen. Parties aur bills account mein import honge;
            wahi workbook dobara import karne par duplicate bills skip honge. Drive par bhejne ke liye
            import ke baad Google Drive + Sheets section mein Sync All dabayein.
          </Text>
          <TouchableOpacity
            testID="import-excel-btn"
            style={[styles.linkBtn, { marginTop: 12 }]}
            disabled={importMut.isPending}
            onPress={chooseExcelWorkbook}
          >
            <Text style={styles.linkBtnText}>
              {importMut.isPending ? "Excel import ho rahi hai…" : "Excel workbook chunen"}
            </Text>
          </TouchableOpacity>
          {!!importMessage && <Text style={styles.status}>{importMessage}</Text>}
        </View>

        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.emailText} testID="account-name">{user?.name || "—"}</Text>
          <Text style={styles.helpText}>
            {user?.email || ""}{user?.email && user?.phone ? " • " : ""}{user?.phone || ""}
            {"\n"}Login: {user?.auth_provider === "google" ? "Google" : user?.auth_provider === "both" ? "Google + Password" : "Password"}
          </Text>
          <TouchableOpacity testID="logout-btn" style={styles.dangerBtn} onPress={() => logout()}>
            <Text style={styles.dangerBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Google Drive block */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Google Drive + Sheets</Text>

          {gstatus?.connected ? (
            <>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>✓ Connected</Text>
              </View>
              {!!gstatus.email && (
                <Text style={styles.emailText} testID="google-email">{gstatus.email}</Text>
              )}
              <Text style={styles.helpText}>
                Har party ka folder Drive me ban jaata hai; har purchase bill Excel + PDF
                ke roop me us folder me upload hota hai. Master Google Sheet me
                ‘Ledger’ tab (kis din kitna purchase / payment out) aur ‘Party Summary’
                tab (party-wise purchase, diya, baaki) apne aap update hote hain.
              </Text>
              <View style={styles.linkRow}>
                {!!gstatus.master_sheet_url && (
                  <TouchableOpacity
                    testID="open-master-sheet-btn"
                    style={styles.linkBtn}
                    onPress={() => Linking.openURL(gstatus.master_sheet_url!)}
                  >
                    <Text style={styles.linkBtnText}>Master Sheet</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  testID="sync-all-btn"
                  style={styles.linkBtn}
                  disabled={syncAllMut.isPending}
                  onPress={() => syncAllMut.mutate()}
                >
                  <Text style={styles.linkBtnText}>
                    {syncAllMut.isPending
                      ? "Sync…"
                      : syncAllMsg || "Sync All"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                testID="google-disconnect-btn"
                style={styles.dangerBtn}
                onPress={() => disconnectMut.mutate()}
              >
                <Text style={styles.dangerBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                testID="google-connect-btn"
                style={styles.googleBtn}
                onPress={connectGoogle}
              >
                <View style={styles.googleLogo}>
                  <Text style={styles.googleLogoText}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Google se Connect karein</Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Connect karne ke baad har invoice automatic Google Drive ki
                party folder me save hogi, aur ek master Google Sheet bhi
                maintain hogi.
              </Text>
            </>
          )}
        </View>

        {/* Shop info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>दुकान की जानकारी</Text>

          <Text style={styles.label}>दुकान का नाम</Text>
          <TextInput
            testID="setting-shop-name"
            value={form.shop_name || ""}
            onChangeText={(t) => setForm({ ...form, shop_name: t })}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Tagline</Text>
          <TextInput
            testID="setting-shop-tagline"
            value={form.shop_tagline || ""}
            onChangeText={(t) => setForm({ ...form, shop_tagline: t })}
            style={styles.input}
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>पता</Text>
          <TextInput
            testID="setting-shop-address"
            value={form.shop_address || ""}
            onChangeText={(t) => setForm({ ...form, shop_address: t })}
            style={styles.input}
            placeholderTextColor={colors.muted}
            multiline
          />

          <Text style={styles.label}>डिफ़ॉल्ट कमीशन %</Text>
          <TextInput
            testID="setting-commission"
            value={String(form.default_commission_percent ?? "")}
            onChangeText={(t) =>
              setForm({ ...form, default_commission_percent: t ? Number(t) : 0 })
            }
            style={styles.input}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.muted}
          />
        </View>

        {/* WhatsApp */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>WhatsApp</Text>
          <Text style={styles.label}>Dukaan ka WhatsApp number</Text>
          <TextInput
            testID="setting-whatsapp"
            value={form.whatsapp_number || ""}
            onChangeText={(t) => setForm({ ...form, whatsapp_number: t })}
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="98765 43210"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.helpText}>
            Bill save hote hi party ke WhatsApp par bill PDF ka message khulta hai
            (party ka mobile number zaroori hai). Is device par WhatsApp installed hona
            chahiye — neeche test karein.
          </Text>
          <TouchableOpacity
            testID="whatsapp-test-btn"
            style={[styles.linkBtn, { marginTop: 10, borderColor: "#25D366" }]}
            onPress={() => {
              let p = (form.whatsapp_number || "").replace(/\D+/g, "");
              if (p.length === 10) p = "91" + p;
              Linking.openURL(`https://wa.me/${p}?text=${encodeURIComponent("Mandi Khata se test message ✅")}`).catch(() => {});
            }}
          >
            <Text style={[styles.linkBtnText, { color: "#128C7E" }]}>WhatsApp connect test karein</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="save-settings-btn"
          style={styles.saveBtn}
          disabled={mut.isPending}
          onPress={() => mut.mutate(form)}
        >
          <Text style={styles.saveBtnText}>
            {mut.isPending ? "सेव हो रहा है…" : "सेटिंग्स सेव करें"}
          </Text>
        </TouchableOpacity>
        {!!savedAt && <Text style={styles.status}>Saved at {savedAt}</Text>}
      </ScrollView>
    </View>
  );
}
