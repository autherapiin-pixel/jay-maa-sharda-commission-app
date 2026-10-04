import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  FlatList,
  Linking,
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

  partyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: c.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  partyName: { fontSize: 22, fontWeight: "900", color: c.onSurface },
  partyMeta: { fontSize: 13, color: c.muted, marginTop: 4 },
  sumBox: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: c.border },
  sumLabel: { fontSize: 10.5, fontWeight: "700", color: c.muted, letterSpacing: 0.3 },
  sumValue: { fontSize: 15, fontWeight: "900", color: c.onSurface, marginTop: 2 },

  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1, backgroundColor: c.brandPrimary,
    paddingVertical: 13, borderRadius: 12, alignItems: "center",
  },
  primaryBtnText: { color: c.onBrandPrimary, fontWeight: "800" },
  outlineBtn: {
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: c.brandPrimary,
  },
  outlineBtnText: { color: c.brandPrimary, fontWeight: "800" },

  sectionTitle: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },

  card: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: c.surfaceSecondary, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, padding: 14,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  dateText: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  netText: { fontSize: 14, fontWeight: "900", color: c.success },
  itemsText: { fontSize: 12, color: c.muted, marginTop: 4 },
  commissionBadge: {
    marginTop: 0,
    alignSelf: "flex-start",
    backgroundColor: c.brandTertiary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  commissionText: { fontSize: 11, color: c.onBrandTertiary, fontWeight: "700" },
  statusChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusChipText: { fontSize: 11, fontWeight: "800" },
  statusPaid: { backgroundColor: "#DCFCE7" },
  statusPartial: { backgroundColor: "#DBEAFE" },
  statusPending: { backgroundColor: "#FEF3C7" },

  pendingBadge: {
    marginTop: 8,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    alignSelf: "flex-start",
  },
  pendingBadgeText: { color: "#991B1B", fontWeight: "800", fontSize: 12 },
  paidBadge: {
    marginTop: 8,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    alignSelf: "flex-start",
  },
  paidBadgeText: { color: "#166534", fontWeight: "800", fontSize: 12 },

  empty: { padding: 20, alignItems: "center" },
  emptyText: { color: c.muted, fontSize: 14, textAlign: "center" },

  deleteBtn: {
    marginHorizontal: 16, marginTop: 20, paddingVertical: 13,
    borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: c.error,
  },
  deleteText: { color: c.error, fontWeight: "700" },
}));

export default function PartyDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: party } = useQuery({
    queryKey: ["party", id],
    queryFn: () => api.getParty(id),
    enabled: !!id,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", id],
    queryFn: () => api.listInvoices(id),
    enabled: !!id,
  });
  const { data: summary } = useQuery({
    queryKey: ["party-summary", id],
    queryFn: () => api.partySummary(id),
    enabled: !!id,
  });

  const delMut = useMutation({
    mutationFn: () => api.deleteParty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      router.back();
    },
  });

  const totalCommission = invoices.reduce((s, i) => s + (i.commission || 0), 0);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="party-back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: "#1F1A14", fontWeight: "700" }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>पार्टी</Text>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        ListHeaderComponent={
          <View>
            <View style={styles.partyHeader}>
              <Text style={styles.partyName} testID="party-detail-name">
                {party?.name || ""}
              </Text>
              {!!party?.location && <Text style={styles.partyMeta}>📍 {party.location}</Text>}
              {!!party?.phone && <Text style={styles.partyMeta}>📞 {party.phone}</Text>}
              <Text style={styles.partyMeta}>
                कुल बिल: {invoices.length} • कुल कमीशन: ₹
                {Math.round(summary?.total_commission ?? totalCommission).toLocaleString()}
              </Text>
              {!!summary && summary.count > 0 && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }} testID="party-summary-cards">
                  <View style={[styles.sumBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={styles.sumLabel}>PURCHASE</Text>
                    <Text style={styles.sumValue}>₹{Math.round(summary.total_net).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.sumBox, { backgroundColor: colors.successSoft }]}>
                    <Text style={[styles.sumLabel, { color: colors.onSuccessSoft }]}>दिया (OUT)</Text>
                    <Text style={[styles.sumValue, { color: colors.onSuccessSoft }]}>₹{Math.round(summary.paid_net).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.sumBox, { backgroundColor: summary.pending_net > 0 ? colors.errorSoft : colors.successSoft }]}>
                    <Text style={[styles.sumLabel, { color: summary.pending_net > 0 ? colors.onErrorSoft : colors.onSuccessSoft }]}>बाकी</Text>
                    <Text style={[styles.sumValue, { color: summary.pending_net > 0 ? colors.onErrorSoft : colors.onSuccessSoft }]}>
                      ₹{Math.round(summary.pending_net).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
              {!!summary && summary.pending_count > 0 && (
                <View style={styles.pendingBadge} testID="party-pending-badge">
                  <Text style={styles.pendingBadgeText}>
                    {summary.pending_count} बिल में बाकी है
                  </Text>
                </View>
              )}
              {!!summary && summary.pending_count === 0 && summary.count > 0 && (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>✓ सब Paid</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                testID="party-new-invoice-btn"
                style={styles.primaryBtn}
                onPress={() => router.push(`/invoice/new?partyId=${id}`)}
              >
                <Text style={styles.primaryBtnText}>+ नयी इनवॉइस</Text>
              </TouchableOpacity>
              {invoices.length > 0 && (
                <TouchableOpacity
                  testID="party-export-btn"
                  style={styles.outlineBtn}
                  onPress={() => Linking.openURL(api.partyExportUrl(id))}
                >
                  <Text style={styles.outlineBtnText}>Export</Text>
                </TouchableOpacity>
              )}
            </View>

            {!!party?.drive_folder_url && (
              <TouchableOpacity
                testID="open-drive-folder-btn"
                style={[styles.outlineBtn, { marginHorizontal: 16, marginTop: 10 }]}
                onPress={() => Linking.openURL(party.drive_folder_url!)}
              >
                <Text style={styles.outlineBtnText}>📁 Drive Folder खोलें</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>सभी इनवॉइस</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>अभी कोई इनवॉइस नहीं है. ऊपर “+ नयी इनवॉइस” टैप करें.</Text>
          </View>
        }
        ListFooterComponent={
          invoices.length === 0 ? (
            <TouchableOpacity
              testID="party-delete-btn"
              style={styles.deleteBtn}
              onPress={() => delMut.mutate()}
            >
              <Text style={styles.deleteText}>पार्टी डिलीट करें</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`invoice-row-${item.id}`}
            style={styles.card}
            onPress={() => router.push(`/invoice/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.dateText}>{item.date}</Text>
              <Text style={styles.netText}>₹{Math.round(item.net).toLocaleString()}</Text>
            </View>
            <Text style={styles.itemsText}>
              आइटम {item.items?.length || 0} • टोटल ₹
              {Math.round(item.items_total).toLocaleString()}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <View style={styles.commissionBadge}>
                <Text style={styles.commissionText}>
                  कमीशन {item.commission_percent}% = ₹
                  {Math.round(item.commission).toLocaleString()}
                </Text>
              </View>
              <View style={[styles.statusChip, item.paid ? styles.statusPaid : (item.paid_amount || 0) > 0 ? styles.statusPartial : styles.statusPending]}>
                <Text style={[styles.statusChipText, { color: item.paid ? "#166534" : (item.paid_amount || 0) > 0 ? "#1D4ED8" : "#92400E" }]}>
                  {item.paid
                    ? "✓ Paid"
                    : (item.paid_amount || 0) > 0
                      ? `मिला ₹${Math.round(item.paid_amount || 0).toLocaleString()} • बाकी ₹${Math.round(item.balance ?? item.net).toLocaleString()}`
                      : `बाकी ₹${Math.round(item.balance ?? item.net).toLocaleString()}`}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
