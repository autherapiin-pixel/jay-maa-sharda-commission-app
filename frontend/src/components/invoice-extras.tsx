import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

import { api } from "@/src/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  wrap: { marginHorizontal: 12, marginTop: 16, gap: 12 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface, marginBottom: 8 },
  input: {
    backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.onSurface, fontFamily: fonts.regular,
    minHeight: 70, textAlignVertical: "top",
  },
  photoBtn: {
    borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong,
    paddingVertical: 18, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.surface,
  },
  photoBtnText: { fontFamily: fonts.medium, color: c.muted, fontSize: 13 },
  photo: { width: "100%", height: 180, borderRadius: 12, backgroundColor: c.surfaceTertiary },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: c.border },
  smallBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurface },
  payRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  payInput: {
    flex: 1, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, color: c.onSurface, fontFamily: fonts.semibold,
  },
  modeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  modeChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  modeText: { fontFamily: fonts.semibold, fontSize: 12, color: c.onSurface },
  modeTextActive: { color: c.onBrandPrimary },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 8 },
}));

const MODES = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "bank", label: "Bank" },
];

type Props = {
  description: string;
  onDescription: (v: string) => void;
  photoPath: string | null;
  onPhoto: (path: string | null) => void;
  paymentOut?: string;
  onPaymentOut?: (v: string) => void;
  paymentMode?: string;
  onPaymentMode?: (v: string) => void;
  net: number;
};

export function InvoiceExtras({ description, onDescription, photoPath, onPhoto, paymentOut, onPaymentOut, paymentMode, onPaymentMode, net }: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function pick(fromCamera: boolean) {
    setErr("");
    try {
      if (fromCamera) {
        const perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted) {
          const req = perm.canAskAgain ? await ImagePicker.requestCameraPermissionsAsync() : perm;
          if (!req.granted) {
            Alert.alert("Camera permission", "Bill ki photo lene ke liye camera chahiye.", [
              { text: "Cancel" },
              { text: "Settings kholen", onPress: () => Linking.openSettings() },
            ]);
            return;
          }
        }
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setUploading(true);
      const form = new FormData();
      const name = a.fileName || `bill_${Date.now()}.jpg`;
      const type = a.mimeType || "image/jpeg";
      if (Platform.OS === "web") {
        const blob = await (await fetch(a.uri)).blob();
        form.append("file", blob, name);
      } else {
        form.append("file", { uri: a.uri, name, type } as any);
      }
      const r = await api.uploadPhoto(form);
      onPhoto(r.path);
    } catch (e: any) {
      setErr(e?.message || "Upload fail hua");
    } finally {
      setUploading(false);
    }
  }

  const outNum = Number(paymentOut) || 0;

  return (
    <View style={s.wrap}>
      {onPaymentOut && (
        <View style={s.card} testID="payment-out-card">
          <Text style={s.title}>💸 Payment Out (party ko abhi diya)</Text>
          <View style={s.payRow}>
            <TextInput
              testID="payment-out-input"
              style={s.payInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={paymentOut}
              onChangeText={onPaymentOut}
            />
            {MODES.map((m) => {
              const active = paymentMode === m.key;
              return (
                <TouchableOpacity key={m.key} testID={`payment-out-mode-${m.key}`} style={[s.modeChip, active && s.modeChipActive]} onPress={() => onPaymentMode?.(m.key)}>
                  <Text style={[s.modeText, active && s.modeTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.hint}>
            {outNum > 0
              ? `नेट ₹${Math.round(net).toLocaleString()} − दिया ₹${Math.round(outNum).toLocaleString()} = बाकी ₹${Math.round(Math.max(net - outNum, 0)).toLocaleString()}`
              : "Khaali chhodein agar abhi kuch nahi diya — baad me Payment Record se jod sakte hain"}
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.title}>📝 विवरण (Description)</Text>
        <TextInput
          testID="description-input"
          style={s.input}
          multiline
          placeholder="जैसे: गाड़ी नं UP70 AB 1234, 2 पेटी खराब निकली…"
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={onDescription}
        />
      </View>

      <View style={s.card}>
        <Text style={s.title}>📷 बिल / माल की फोटो</Text>
        {photoPath ? (
          <View>
            <Image source={{ uri: api.fileUrl(photoPath) }} style={s.photo} contentFit="cover" transition={200} />
            <View style={s.photoActions}>
              <TouchableOpacity testID="photo-replace-btn" style={s.smallBtn} onPress={() => pick(false)}>
                <Text style={s.smallBtnText}>बदलें</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="photo-remove-btn" style={[s.smallBtn, { borderColor: colors.error }]} onPress={() => onPhoto(null)}>
                <Text style={[s.smallBtnText, { color: colors.error }]}>हटाएँ</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : uploading ? (
          <View style={s.photoBtn}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={s.photoBtnText}>Upload ho raha hai…</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Platform.OS !== "web" && (
              <TouchableOpacity testID="photo-camera-btn" style={[s.photoBtn, { flex: 1 }]} onPress={() => pick(true)}>
                <Ionicons name="camera-outline" size={24} color={colors.brandPrimary} />
                <Text style={s.photoBtnText}>Camera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="photo-gallery-btn" style={[s.photoBtn, { flex: 1 }]} onPress={() => pick(false)}>
              <Ionicons name="images-outline" size={24} color={colors.brandPrimary} />
              <Text style={s.photoBtnText}>Gallery se chunein</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!err && <Text style={[s.hint, { color: colors.error }]}>{err}</Text>}
      </View>
    </View>
  );
}
