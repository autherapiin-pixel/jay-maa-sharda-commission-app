import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { api, Party } from "@/src/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: { fontSize: 24, fontFamily: fonts.bold, color: c.onBrandPrimary },
  subtitle: { fontSize: 12.5, fontFamily: fonts.regular, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -22,
  },
  searchInput: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtn: {
    backgroundColor: c.brandPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addBtnText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 20 },

  card: {
    backgroundColor: c.surfaceSecondary,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: c.onBrandSecondary, fontWeight: "800", fontSize: 16 },
  partyName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  partyLoc: { fontSize: 12, color: c.muted, marginTop: 2 },

  empty: { alignItems: "center", marginTop: 50 },
  emptyText: { color: c.muted, fontSize: 14 },

  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: 16 },
  label: { fontSize: 12, color: c.muted, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: c.onSurface,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  saveBtn: {
    backgroundColor: c.brandPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: c.muted, fontWeight: "600" },
}));

export default function Parties() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCommission, setNewCommission] = useState("");

  const { data: parties = [] } = useQuery({
    queryKey: ["parties", search],
    queryFn: () => api.listParties(search || undefined),
  });

  const createMut = useMutation({
    mutationFn: (p: Partial<Party>) => api.createParty(p),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setShowAdd(false);
      setNewName(""); setNewLoc(""); setNewPhone(""); setNewCommission("");
      router.push(`/party/${p.id}`);
    },
  });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.brandGradientStart, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>पार्टी</Text>
        <Text style={styles.subtitle}>सर्च करें या नयी पार्टी जोड़ें</Text>
      </LinearGradient>

      <View style={styles.searchRow}>
        <TextInput
          testID="parties-search-input"
          placeholder="पार्टी नाम ढूंढें…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <TouchableOpacity
          testID="parties-add-btn"
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={parties}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {search ? "कोई पार्टी नहीं मिली" : "अभी कोई पार्टी नहीं है"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`party-row-${item.id}`}
            style={styles.card}
            onPress={() => router.push(`/party/${item.id}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>{item.name}</Text>
              {!!item.location && <Text style={styles.partyLoc}>{item.location}</Text>}
            </View>
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>›</Text>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={styles.sheetTitle}>नयी पार्टी जोड़ें</Text>

            <Text style={styles.label}>पार्टी नाम *</Text>
            <TextInput
              testID="new-party-name-input"
              placeholder="जैसे: मुन्ना भाई फूलपुर"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              style={styles.input}
            />

            <Text style={styles.label}>जगह</Text>
            <TextInput
              testID="new-party-location-input"
              placeholder="जैसे: फूलपुर"
              placeholderTextColor={colors.muted}
              value={newLoc}
              onChangeText={setNewLoc}
              style={styles.input}
            />

            <Text style={styles.label}>फ़ोन (optional)</Text>
            <TextInput
              testID="new-party-phone-input"
              placeholder="मोबाइल नंबर"
              placeholderTextColor={colors.muted}
              value={newPhone}
              onChangeText={setNewPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>डिफ़ॉल्ट कमीशन % (खाली छोड़ें = 6%)</Text>
            <TextInput
              testID="new-party-commission-input"
              placeholder="6"
              placeholderTextColor={colors.muted}
              value={newCommission}
              onChangeText={setNewCommission}
              style={styles.input}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              testID="save-party-btn"
              style={styles.saveBtn}
              disabled={!newName.trim() || createMut.isPending}
              onPress={() =>
                createMut.mutate({
                  name: newName.trim(),
                  location: newLoc.trim(),
                  phone: newPhone.trim(),
                  default_commission_percent: newCommission ? Number(newCommission) : undefined,
                })
              }
            >
              <Text style={styles.saveBtnText}>
                {createMut.isPending ? "सेव हो रहा है…" : "पार्टी सेव करें"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelText}>कैंसल</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
