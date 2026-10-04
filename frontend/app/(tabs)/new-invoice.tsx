import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api";
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

  searchWrap: { paddingHorizontal: 16, marginTop: -22 },
  searchInput: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: c.border,
  },

  partyRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: c.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: c.onBrandSecondary, fontWeight: "800" },
  partyName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  partyLoc: { fontSize: 12, color: c.muted, marginTop: 2 },

  hint: { padding: 20, alignItems: "center" },
  hintText: { color: c.muted, fontSize: 13, textAlign: "center" },

  addBanner: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: c.brandSecondary,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBannerText: { color: c.onBrandTertiary, fontWeight: "700" },
  addBannerBtn: {
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBannerBtnText: { color: c.onBrandPrimary, fontWeight: "700" },
}));

export default function NewInvoiceTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const { data: parties = [] } = useQuery({
    queryKey: ["parties", search],
    queryFn: () => api.listParties(search || undefined),
  });

  const noMatch = useMemo(
    () => !!search.trim() && parties.length === 0,
    [search, parties.length],
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.brandGradientStart, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>नयी इनवॉइस</Text>
        <Text style={styles.subtitle}>पार्टी चुनें या नयी पार्टी जोड़ें</Text>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <TextInput
          testID="new-invoice-search-input"
          placeholder="पार्टी नाम सर्च करें…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          autoFocus
        />
      </View>

      {noMatch && (
        <View style={styles.addBanner}>
          <Text style={styles.addBannerText}>
            “{search}” नहीं मिली. नयी बनाएँ?
          </Text>
          <TouchableOpacity
            testID="create-missing-party-btn"
            style={styles.addBannerBtn}
            onPress={() => router.push("/(tabs)/parties")}
          >
            <Text style={styles.addBannerBtnText}>+ जोड़ें</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={parties}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 + insets.bottom }}
        ListEmptyComponent={
          !search ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>
                टाइप करके पार्टी ढूंढें, फिर टैप करें और उसी पार्टी की नयी बिल बनाएँ.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`new-invoice-pick-party-${item.id}`}
            style={styles.partyRow}
            onPress={() => router.push(`/invoice/new?partyId=${item.id}`)}
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
    </View>
  );
}
