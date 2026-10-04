import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { Card, invoiceStatus, money, StatusChip } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 20, paddingBottom: 54, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  hello: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  shop: { fontFamily: fonts.bold, fontSize: 22, color: c.onBrandPrimary, marginTop: 2 },
  shopSub: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },

  heroCard: { marginHorizontal: 16, marginTop: -40, padding: 18 },
  heroLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.muted, letterSpacing: 0.4 },
  heroValue: { fontFamily: fonts.bold, fontSize: 30, color: c.onSurface, marginTop: 2, fontVariant: ["tabular-nums"] },
  heroRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  heroStat: { flex: 1, borderRadius: 14, padding: 12 },
  heroStatLabel: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.3 },
  heroStatValue: { fontFamily: fonts.semibold, fontSize: 17, marginTop: 2, fontVariant: ["tabular-nums"] },

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, padding: 14, alignItems: "flex-start" },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted },
  statValue: { fontFamily: fonts.semibold, fontSize: 18, color: c.onSurface, marginTop: 1 },

  quick: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 16 },
  quickBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  quickText: { fontFamily: fonts.semibold, fontSize: 14 },

  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: c.onSurface },
  sectionLink: { fontFamily: fonts.medium, fontSize: 13, color: c.brandPrimary },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowAvatarText: { fontFamily: fonts.semibold, color: c.onBrandTertiary, fontSize: 16 },
  rowParty: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  rowNet: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: c.divider },

  empty: { alignItems: "center", paddingVertical: 28 },
  emptyTitle: { fontFamily: fonts.semibold, color: c.onSurface, fontSize: 15, marginTop: 10 },
  emptyText: { fontFamily: fonts.regular, color: c.muted, fontSize: 13, marginTop: 4, textAlign: "center" },
}));

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: stats, refetch, isFetching } = useQuery({ queryKey: ["stats"], queryFn: api.getStats });
  const { data: daybook } = useQuery({ queryKey: ["daybook", "month"], queryFn: () => api.daybook("month") });

  const paidOut = daybook?.totals.paid_net ?? 0;
  const purchase = stats?.total_net ?? 0;
  const balance = stats?.pending_net ?? 0;
  const initial = (user?.name || user?.email || "M").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.brandGradientStart, colors.brandGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>नमस्ते{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</Text>
              <Text style={styles.shop} testID="shop-name" numberOfLines={1}>
                {settings?.shop_name || "Mandi Khata"}
              </Text>
              <Text style={styles.shopSub} numberOfLines={1}>{settings?.shop_tagline || ""}</Text>
            </View>
            <TouchableOpacity testID="home-avatar" style={styles.avatar} onPress={() => router.push("/(tabs)/settings")}>
              <Text style={{ fontFamily: fonts.bold, color: colors.onBrandPrimary }}>{initial}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>कुल PURCHASE (NET)</Text>
          <Text style={styles.heroValue} testID="stat-purchase">{money(purchase)}</Text>
          <View style={styles.heroRow}>
            <View style={[styles.heroStat, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.heroStatLabel, { color: colors.onSuccessSoft }]}>PAYMENT OUT (दिया)</Text>
              <Text style={[styles.heroStatValue, { color: colors.onSuccessSoft }]} testID="stat-paid-out">{money(paidOut)}</Text>
            </View>
            <TouchableOpacity
              testID="home-pending-card"
              style={[styles.heroStat, { backgroundColor: balance > 0 ? colors.errorSoft : colors.surfaceTertiary }]}
              onPress={() => router.push("/daybook")}
            >
              <Text style={[styles.heroStatLabel, { color: balance > 0 ? colors.onErrorSoft : colors.muted }]}>
                बाकी (DENA) • {stats?.pending_count ?? 0} बिल
              </Text>
              <Text style={[styles.heroStatValue, { color: balance > 0 ? colors.onErrorSoft : colors.onSurface }]} testID="stat-balance">
                {money(balance)}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="people" size={16} color={colors.onBrandTertiary} />
            </View>
            <Text style={styles.statLabel}>Parties</Text>
            <Text style={styles.statValue} testID="stat-parties">{stats?.parties ?? 0}</Text>
          </Card>
          <Card style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="receipt" size={16} color={colors.onInfoSoft} />
            </View>
            <Text style={styles.statLabel}>Bills</Text>
            <Text style={styles.statValue} testID="stat-invoices">{stats?.invoices ?? 0}</Text>
          </Card>
          <Card style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="trending-up" size={16} color={colors.onSuccessSoft} />
            </View>
            <Text style={styles.statLabel}>कमीशन</Text>
            <Text style={[styles.statValue, { color: colors.brandPrimary }]} testID="stat-commission">
              {money(stats?.total_commission)}
            </Text>
          </Card>
        </View>

        <View style={styles.quick}>
          <TouchableOpacity testID="home-new-invoice-btn" activeOpacity={0.85} onPress={() => router.push("/(tabs)/new-invoice")} style={{ flex: 1 }}>
            <LinearGradient colors={[colors.brandGradientStart, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickBtn}>
              <Ionicons name="add-circle" size={22} color={colors.onBrandPrimary} />
              <Text style={[styles.quickText, { color: colors.onBrandPrimary }]}>नया बिल</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-daybook-btn"
            activeOpacity={0.85}
            onPress={() => router.push("/daybook")}
            style={[styles.quickBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
          >
            <Ionicons name="bar-chart" size={20} color={colors.brandPrimary} />
            <Text style={[styles.quickText, { color: colors.onSurface }]}>Daybook</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>हाल के बिल</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/parties")}>
              <Text style={styles.sectionLink}>सभी पार्टी ›</Text>
            </TouchableOpacity>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {!stats?.recent?.length ? (
              <View style={styles.empty}>
                <Ionicons name="book-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyTitle}>अभी कोई बिल नहीं</Text>
                <Text style={styles.emptyText}>“नया बिल” दबाकर पहली entry करें</Text>
              </View>
            ) : (
              stats.recent.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <TouchableOpacity testID={`recent-invoice-${inv.id}`} style={styles.row} onPress={() => router.push(`/invoice/${inv.id}`)}>
                    <View style={styles.rowAvatar}>
                      <Text style={styles.rowAvatarText}>{inv.party_name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowParty} numberOfLines={1}>{inv.party_name}</Text>
                      <Text style={styles.rowMeta}>{inv.date} • कमीशन {money(inv.commission)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.rowNet}>{money(inv.net)}</Text>
                      <StatusChip status={invoiceStatus(inv)} />
                    </View>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
