import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: c.invoiceHeader,
    gap: 6,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  topTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: "#1F1A14" },

  periodToggle: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
  },
  pillActive: {
    backgroundColor: c.brandPrimary,
    borderColor: c.brandPrimary,
  },
  pillText: { fontWeight: "700", color: c.onSurface },
  pillTextActive: { color: c.onBrandPrimary },

  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  sumHeader: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  sumLabel: { color: c.muted, fontSize: 13 },
  sumValue: { color: c.onSurface, fontWeight: "700", fontSize: 13 },
  sumValueBold: { color: c.success, fontWeight: "900", fontSize: 15 },
  sumValuePending: { color: c.error, fontWeight: "900", fontSize: 15 },

  sectionTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },

  row: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: c.surfaceSecondary, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, padding: 14,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowPeriod: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  rowCount: { fontSize: 12, color: c.muted },
  rowStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 },
  rowStatItem: { flexDirection: "column" },
  rowStatLabel: { fontSize: 11, color: c.muted, fontWeight: "700" },
  rowStatValue: { fontSize: 13, color: c.onSurface, fontWeight: "800" },
  rowStatNet: { color: c.success },

  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: c.muted, fontSize: 13, textAlign: "center" },
}));

export default function Daybook() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<"day" | "month">("day");

  const { data, isLoading } = useQuery({
    queryKey: ["daybook", period],
    queryFn: () => api.daybook(period),
  });

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="daybook-back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: "#1F1A14", fontWeight: "700" }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Daybook / रिपोर्ट</Text>
      </View>

      <View style={styles.periodToggle}>
        {(["day", "month"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            testID={`period-${p}`}
            style={[styles.pill, period === p && styles.pillActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.pillText, period === p && styles.pillTextActive]}>
              {p === "day" ? "दिन" : "महीना"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sumHeader}>कुल (All time)</Text>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Bills</Text>
          <Text style={styles.sumValue}>{data?.totals.invoices ?? 0}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Items टोटल</Text>
          <Text style={styles.sumValue}>₹{Math.round(data?.totals.items_total ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>भाड़ा</Text>
          <Text style={styles.sumValue}>₹{Math.round(data?.totals.bhada ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>मजदूरी</Text>
          <Text style={styles.sumValue}>₹{Math.round(data?.totals.mazdoori ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>कुल कमीशन</Text>
          <Text style={styles.sumValueBold}>₹{Math.round(data?.totals.commission ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>मिला (Received)</Text>
          <Text style={styles.sumValueBold}>₹{Math.round(data?.totals.paid_net ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>बाकी</Text>
          <Text style={styles.sumValuePending}>₹{Math.round(data?.totals.pending_net ?? 0).toLocaleString()}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{period === "day" ? "दिन के हिसाब से" : "महीने के हिसाब से"}</Text>

      <FlatList
        data={data?.rows ?? []}
        keyExtractor={(r) => r.period}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {isLoading ? "Loading…" : "अभी कोई इनवॉइस नहीं है"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row} testID={`daybook-row-${item.period}`}>
            <View style={styles.rowTop}>
              <Text style={styles.rowPeriod}>{item.period}</Text>
              <Text style={styles.rowCount}>{item.invoices} bills</Text>
            </View>
            <View style={styles.rowStats}>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>ITEMS</Text>
                <Text style={styles.rowStatValue}>₹{Math.round(item.items_total).toLocaleString()}</Text>
              </View>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>भाड़ा</Text>
                <Text style={styles.rowStatValue}>₹{Math.round(item.bhada).toLocaleString()}</Text>
              </View>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>मजदूरी</Text>
                <Text style={styles.rowStatValue}>₹{Math.round(item.mazdoori).toLocaleString()}</Text>
              </View>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>कमीशन</Text>
                <Text style={[styles.rowStatValue, { color: colors.brandPrimary }]}>
                  ₹{Math.round(item.commission).toLocaleString()}
                </Text>
              </View>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>NET</Text>
                <Text style={[styles.rowStatValue, styles.rowStatNet]}>
                  ₹{Math.round(item.net).toLocaleString()}
                </Text>
              </View>
              <View style={styles.rowStatItem}>
                <Text style={styles.rowStatLabel}>बाकी</Text>
                <Text style={[styles.rowStatValue, { color: colors.error }]}>
                  ₹{Math.round(item.pending_net).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
