import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Invoice, InvoiceItem, Payment, Settings } from "@/src/api";
import { InvoiceExtras } from "@/src/components/invoice-extras";
import { PaymentSection } from "@/src/components/payment-section";
import { makeStyles, useTheme } from "@/src/theme";
import * as Haptics from "expo-haptics";

type Props = {
  mode: "create" | "edit";
  partyId: string;
  partyName: string;
  partyPhone?: string;
  settings?: Settings;
  initial?: Invoice;
};

function emptyItem(): InvoiceItem {
  return { sr: undefined, item: "", qty: 0, rate: 0, total: 0 };
}

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
  topTitle: { fontSize: 17, fontWeight: "800", color: "#1F1A14", flex: 1 },
  topBtn: {
    padding: 8,
    borderRadius: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },

  shopBand: {
    backgroundColor: c.invoiceHeader,
    paddingVertical: 10,
    alignItems: "center",
  },
  shopName: { fontSize: 18, fontWeight: "900", color: "#1F1A14" },
  taglineBand: {
    backgroundColor: c.invoiceGreen,
    paddingVertical: 6,
    alignItems: "center",
  },
  tagline: { fontSize: 13, fontWeight: "700", color: "#1F1A14" },
  addressBand: {
    backgroundColor: "#111111",
    paddingVertical: 7,
    alignItems: "center",
  },
  address: { fontSize: 12, fontWeight: "700", color: "#fff" },

  partyRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    borderTopWidth: 0,
  },
  partyCell: {
    flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: "#000",
  },
  dateCell: { padding: 10, borderRightWidth: 1, borderRightColor: "#000", width: 110 },
  dateInput: {
    fontSize: 13, color: c.onSurface, padding: 0, margin: 0,
  },
  cellLabel: { fontSize: 11, color: c.muted, fontWeight: "700" },
  cellValue: { fontSize: 14, color: c.onSurface, fontWeight: "700" },

  tableHead: {
    flexDirection: "row",
    backgroundColor: c.invoiceTableHead,
    borderWidth: 1, borderColor: "#000", borderTopWidth: 0,
  },
  th: {
    paddingVertical: 8,
    color: c.onInvoiceTableHead,
    fontWeight: "800",
    textAlign: "center",
    fontSize: 12,
    borderRightWidth: 1, borderRightColor: "#333",
  },

  tr: {
    flexDirection: "row",
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000",
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 1, borderRightColor: "#000",
    minHeight: 36,
    justifyContent: "center",
  },
  cellInput: {
    fontSize: 13,
    color: c.onSurface,
    padding: 0,
    textAlign: "center",
  },
  cellInputItem: { textAlign: "left" },
  cellTotal: { backgroundColor: c.invoiceTableRow },

  rowDeleteBtn: {
    paddingHorizontal: 8,
    justifyContent: "center",
    borderRightWidth: 1, borderRightColor: "#000",
  },

  addItemBtn: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: c.brandPrimary,
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
  },
  addItemText: { color: c.brandPrimary, fontWeight: "700" },

  totalsRow: {
    flexDirection: "row",
    marginTop: 10,
    marginHorizontal: 0,
    backgroundColor: c.invoiceTotalRow,
    borderWidth: 1, borderColor: "#000",
  },
  totalsLeft: {
    width: 50, padding: 8, alignItems: "center", justifyContent: "center",
    borderRightWidth: 1, borderRightColor: "#000",
  },
  totalsMid: {
    flex: 1, padding: 8, alignItems: "flex-end", justifyContent: "center",
    borderRightWidth: 1, borderRightColor: "#000",
  },
  totalsRight: { width: 110, padding: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: c.invoiceTableRow },

  totalsBold: { fontWeight: "800", color: "#000" },

  expenseWrap: { marginTop: 10, borderWidth: 1, borderColor: "#000" },
  expenseRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 40,
  },
  expenseLabel: {
    width: 120, padding: 10,
    backgroundColor: "#DCE9F7",
    borderRightWidth: 1, borderRightColor: "#000",
    justifyContent: "center",
  },
  expenseLabelText: { fontWeight: "800", color: "#000" },
  expenseInput: {
    flex: 1,
    padding: 10,
    color: c.onSurface,
    fontSize: 14,
    textAlign: "center",
  },

  netRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    borderTopWidth: 0,
    backgroundColor: c.invoiceNetRow,
  },
  netLabel: {
    flex: 1, padding: 10,
    borderRightWidth: 1, borderRightColor: "#000",
    alignItems: "flex-end", justifyContent: "center",
  },
  netValue: {
    width: 110, padding: 10,
    alignItems: "center", justifyContent: "center",
  },
  netText: { fontWeight: "900", color: "#000", fontSize: 15 },

  footer: {
    marginTop: 20,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 10,
  },
  saveBtn: {
    flex: 1, backgroundColor: c.brandPrimary, paddingVertical: 15, borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  exportBtn: {
    paddingVertical: 15, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: c.brandPrimary, alignItems: "center",
  },
  exportBtnText: { color: c.brandPrimary, fontWeight: "800" },
  deleteBtn: {
    marginTop: 10, marginHorizontal: 0,
    paddingVertical: 12, borderRadius: 10,
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1, borderColor: c.error,
  },
  deleteBtnText: { color: c.error, fontWeight: "700" },

  status: { textAlign: "center", color: c.success, marginTop: 10 },

  // Suggestions
  suggestWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: c.brandTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.brandSecondary,
  },
  suggestTitle: { fontSize: 11, color: c.onBrandTertiary, fontWeight: "700", marginBottom: 6 },
  suggestList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: c.surfaceSecondary, borderRadius: 999,
    borderWidth: 1, borderColor: c.brandSecondary,
  },
  suggestChipText: { fontSize: 12, color: c.onSurface, fontWeight: "600" },

  // Edit actions wrap
  editActionsWrap: { paddingHorizontal: 16, gap: 10, marginTop: 10 },

  // WhatsApp
  waBtn: {
    backgroundColor: "#25D366",
    paddingVertical: 14, borderRadius: 12, alignItems: "center",
  },
  waBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Generic link
  linkBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
    borderWidth: 1.5, borderColor: c.brandPrimary,
  },
  linkBtnText: { color: c.brandPrimary, fontWeight: "700" },
}));

export function InvoiceForm({ mode, partyId, partyName, partyPhone, settings, initial }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const defaultPct =
    initial?.commission_percent ??
    settings?.default_commission_percent ??
    6;

  const [date, setDate] = useState<string>(initial?.date || todayISO());
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items?.length ? [...initial.items] : [emptyItem(), emptyItem(), emptyItem()],
  );
  const [bhada, setBhada] = useState<string>(String(initial?.bhada ?? ""));
  const [mazdoori, setMazdoori] = useState<string>(String(initial?.mazdoori ?? ""));
  const [commissionPct, setCommissionPct] = useState<string>(String(defaultPct ?? 6));
  const [srTotal, setSrTotal] = useState<string>(String(initial?.sr_total ?? ""));
  const [status, setStatus] = useState<string>("");
  const [payments, setPayments] = useState<Payment[]>(initial?.payments ?? []);
  const [suggestFor, setSuggestFor] = useState<number | null>(null);
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.photo_path ?? null);
  const [paymentOut, setPaymentOut] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");

  const { data: memory = [] } = useQuery({
    queryKey: ["party-items", partyId],
    queryFn: () => api.partyItems(partyId),
  });

  const totals = useMemo(() => {
    let itemsTotal = 0;
    for (const it of items) {
      const t = Number(it.total) || Number(it.qty) * Number(it.rate) || 0;
      itemsTotal += t;
    }
    const pct = Number(commissionPct) || 0;
    const comm = Math.round((itemsTotal * pct) / 100 * 100) / 100;
    const kharch = (Number(bhada) || 0) + (Number(mazdoori) || 0) + comm;
    const net = itemsTotal - kharch;
    return { itemsTotal, comm, kharch, net };
  }, [items, bhada, mazdoori, commissionPct]);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      const row = next[idx];
      // auto compute total if qty & rate given but no manual override
      if (patch.qty !== undefined || patch.rate !== undefined) {
        const q = Number(row.qty) || 0;
        const r = Number(row.rate) || 0;
        row.total = q && r ? Math.round(q * r * 100) / 100 : row.total;
      }
      return next;
    });
  }

  function addRow() {
    setItems((p) => [...p, emptyItem()]);
  }
  function removeRow(idx: number) {
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));
  }

  const createMut = useMutation({
    mutationFn: () =>
      api.createInvoice({
        party_id: partyId,
        date,
        items: items.filter((i) => i.item?.trim() || i.qty || i.rate || i.total),
        bhada: Number(bhada) || 0,
        mazdoori: Number(mazdoori) || 0,
        commission_percent: Number(commissionPct) || 0,
        sr_total: Number(srTotal) || 0,
        description,
        photo_path: photoPath,
        payment_out: Number(paymentOut) || 0,
        payment_out_mode: paymentMode,
      } as any),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["party-summary", partyId] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Purchase entry hote hi party ko WhatsApp par PDF bhejo
      if ((partyPhone || "").replace(/\D+/g, "").length >= 10) {
        shareWhatsApp(inv);
      }
      router.replace(`/invoice/${inv.id}`);
    },
  });

  const [savedNet, setSavedNet] = useState<number>(initial?.net ?? 0);

  const updateMut = useMutation({
    mutationFn: () =>
      api.updateInvoice(initial!.id, {
        date,
        items: items.filter((i) => i.item?.trim() || i.qty || i.rate || i.total),
        bhada: Number(bhada) || 0,
        mazdoori: Number(mazdoori) || 0,
        commission_percent: Number(commissionPct) || 0,
        sr_total: Number(srTotal) || 0,
        description,
        photo_path: photoPath,
      } as any),
    onSuccess: (inv) => {
      setSavedNet(inv.net);
      setPayments(inv.payments ?? []);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["party-summary", partyId] });
      setStatus("Saved!");
      setTimeout(() => setStatus(""), 2000);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteInvoice(initial!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      router.back();
    },
  });

  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(Math.round((savedNet - paidAmount) * 100) / 100, 0);
  const paid = savedNet - paidAmount <= 0.005;

  const saving = createMut.isPending || updateMut.isPending;

  function openExport() {
    if (!initial) return;
    const url = api.invoiceExportUrl(initial.id);
    Linking.openURL(url).catch(() => {});
  }

  function shareWhatsApp(target?: Invoice) {
    const inv = target || initial;
    if (!inv) return;
    const shop = settings?.shop_name || "";
    const commissionTxt = `कमीशन (${inv.commission_percent}%)`;
    const pdfLink = inv.drive_pdf_url || api.publicPdfUrl(inv.id);
    const given = target ? (inv.paid_amount || 0) : paidAmount;
    const due = target ? Math.max((inv.balance ?? inv.net - given), 0) : balance;
    const isPaid = target ? !!inv.paid : paid;
    const paidLine = isPaid
      ? `\nStatus: PAID ✅`
      : given > 0
        ? `\nदिया: ₹${Math.round(given)}\n*बाकी: ₹${Math.round(due)}*`
        : `\nStatus: बाकी ₹${Math.round(due)}`;
    const text =
      `*${shop}*\n` +
      `Purchase बिल\n` +
      `पार्टी: ${partyName}\n` +
      `Date: ${inv.date}\n` +
      `-----------------------------\n` +
      `Items Total: ₹${Math.round(inv.items_total)}\n` +
      `भाड़ा: ₹${Math.round(inv.bhada)}\n` +
      `मजदूरी: ₹${Math.round(inv.mazdoori)}\n` +
      `${commissionTxt}: ₹${Math.round(inv.commission)}\n` +
      `खर्च टोटल: ₹${Math.round(inv.kharch_total)}\n` +
      `-----------------------------\n` +
      `*नेट: ₹${Math.round(inv.net)}*` +
      paidLine +
      (inv.description ? `\n\nविवरण: ${inv.description}` : "") +
      `\n\n📄 बिल PDF:\n${pdfLink}`;
    const encoded = encodeURIComponent(text);
    // Clean phone number: digits only, prepend 91 if 10 digits
    let phone = (partyPhone || "").replace(/\D+/g, "");
    if (phone.length === 10) phone = "91" + phone;
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url).catch(() => {});
  }

  function pickSuggestion(idx: number, s: { item: string; last_rate: number }) {
    updateItem(idx, { item: s.item, rate: s.last_rate });
    setSuggestFor(null);
  }

  function suggestionsFor(idx: number) {
    if (suggestFor !== idx) return [] as typeof memory;
    const q = (items[idx]?.item || "").trim().toLowerCase();
    const list = memory.filter((m) =>
      q ? m.item.toLowerCase().includes(q) : true,
    );
    return list.slice(0, 6);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: "#1F1A14", fontWeight: "700" }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>
          {mode === "create" ? "नयी इनवॉइस" : "इनवॉइस"}
        </Text>
        {mode === "edit" && (
          <TouchableOpacity testID="export-btn" style={styles.iconBtn} onPress={openExport}>
            <Text style={{ fontSize: 14, color: "#1F1A14", fontWeight: "800" }}>⤓ Excel</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Invoice shop bands */}
        <View style={styles.shopBand}>
          <Text style={styles.shopName}>{settings?.shop_name || ""}</Text>
        </View>
        <View style={styles.taglineBand}>
          <Text style={styles.tagline}>{settings?.shop_tagline || ""}</Text>
        </View>
        <View style={styles.addressBand}>
          <Text style={styles.address}>{settings?.shop_address || ""}</Text>
        </View>

        {/* Party + date row */}
        <View style={styles.partyRow}>
          <View style={styles.partyCell}>
            <Text style={styles.cellLabel}>पार्टी नाम</Text>
            <Text style={styles.cellValue} testID="form-party-name">{partyName}</Text>
          </View>
          <View style={styles.dateCell}>
            <Text style={styles.cellLabel}>Date</Text>
            <TextInput
              testID="form-date-input"
              value={date}
              onChangeText={setDate}
              style={[styles.cellValue, { padding: 0 }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: 50 }]}>SR</Text>
          <Text style={[styles.th, { flex: 2 }]}>ITEM</Text>
          <Text style={[styles.th, { width: 60 }]}>QTY</Text>
          <Text style={[styles.th, { width: 60 }]}>RATE</Text>
          <Text style={[styles.th, { width: 80, borderRightWidth: 0 }]}>TOTAL</Text>
        </View>

        {/* Rows */}
        {items.map((it, idx) => (
          <View style={styles.tr} key={idx}>
            <View style={[styles.cell, { width: 50 }]}>
              <TextInput
                testID={`row-${idx}-sr`}
                value={it.sr != null ? String(it.sr) : ""}
                onChangeText={(t) => updateItem(idx, { sr: t ? Number(t) : undefined })}
                keyboardType="numeric"
                style={styles.cellInput}
              />
            </View>
            <View style={[styles.cell, { flex: 2 }]}>
              <TextInput
                testID={`row-${idx}-item`}
                value={it.item}
                onChangeText={(t) => updateItem(idx, { item: t })}
                onFocus={() => setSuggestFor(idx)}
                onBlur={() => setTimeout(() => setSuggestFor((v) => (v === idx ? null : v)), 150)}
                style={[styles.cellInput, styles.cellInputItem]}
                placeholder="जैसे: केला"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.cell, { width: 60 }]}>
              <TextInput
                testID={`row-${idx}-qty`}
                value={it.qty ? String(it.qty) : ""}
                onChangeText={(t) => updateItem(idx, { qty: Number(t) || 0 })}
                keyboardType="decimal-pad"
                style={styles.cellInput}
              />
            </View>
            <View style={[styles.cell, { width: 60 }]}>
              <TextInput
                testID={`row-${idx}-rate`}
                value={it.rate ? String(it.rate) : ""}
                onChangeText={(t) => updateItem(idx, { rate: Number(t) || 0 })}
                keyboardType="decimal-pad"
                style={styles.cellInput}
              />
            </View>
            <View style={[styles.cell, styles.cellTotal, { width: 80, borderRightWidth: 0 }]}>
              <TextInput
                testID={`row-${idx}-total`}
                value={it.total ? String(it.total) : ""}
                onChangeText={(t) => updateItem(idx, { total: Number(t) || 0 })}
                keyboardType="decimal-pad"
                style={[styles.cellInput, { flex: 1 }]}
              />
            </View>
            <TouchableOpacity
              testID={`row-${idx}-delete`}
              onPress={() => removeRow(idx)}
              style={{ paddingHorizontal: 10, justifyContent: "center", minWidth: 44, alignItems: "center" }}
            >
              <Text style={{ color: colors.error, fontWeight: "800", fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity testID="add-row-btn" style={styles.addItemBtn} onPress={addRow}>
          <Text style={styles.addItemText}>+ नया आइटम जोड़ें</Text>
        </TouchableOpacity>

        {/* Item suggestions from this party's past invoices */}
        {suggestFor !== null && suggestionsFor(suggestFor).length > 0 && (
          <View style={styles.suggestWrap} testID="item-suggestions">
            <Text style={styles.suggestTitle}>पहले इस्तेमाल किए हुए:</Text>
            <View style={styles.suggestList}>
              {suggestionsFor(suggestFor).map((s) => (
                <TouchableOpacity
                  key={s.item}
                  testID={`suggest-${s.item}`}
                  style={styles.suggestChip}
                  onPress={() => pickSuggestion(suggestFor, s)}
                >
                  <Text style={styles.suggestChipText}>
                    {s.item} · ₹{Math.round(s.last_rate)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* SR total + items TOTAL */}
        <View style={{ marginTop: 10 }}>
          <View style={styles.totalsRow}>
            <View style={styles.totalsLeft}>
              <TextInput
                testID="sr-total-input"
                value={srTotal}
                onChangeText={setSrTotal}
                keyboardType="numeric"
                style={styles.totalsBold}
                placeholder="SR"
                placeholderTextColor="#5a4420"
              />
            </View>
            <View style={styles.totalsMid}>
              <Text style={styles.totalsBold}>TOTAL</Text>
            </View>
            <View style={styles.totalsRight}>
              <Text style={styles.totalsBold} testID="items-total">
                {Math.round(totals.itemsTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Expense block */}
        <View style={styles.expenseWrap}>
          <View style={styles.expenseRow}>
            <View style={styles.expenseLabel}>
              <Text style={styles.expenseLabelText}>भाड़ा</Text>
            </View>
            <TextInput
              testID="bhada-input"
              value={bhada}
              onChangeText={setBhada}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.expenseInput}
            />
          </View>
          <View style={styles.expenseRow}>
            <View style={styles.expenseLabel}>
              <Text style={styles.expenseLabelText}>मजदूरी</Text>
            </View>
            <TextInput
              testID="mazdoori-input"
              value={mazdoori}
              onChangeText={setMazdoori}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.expenseInput}
            />
          </View>
          <View style={styles.expenseRow}>
            <View style={styles.expenseLabel}>
              <Text style={styles.expenseLabelText}>कमीशन (%)</Text>
            </View>
            <TextInput
              testID="commission-pct-input"
              value={commissionPct}
              onChangeText={setCommissionPct}
              keyboardType="decimal-pad"
              placeholder="6"
              placeholderTextColor={colors.muted}
              style={styles.expenseInput}
            />
            <View style={{ width: 80, padding: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#CFE7F6", borderLeftWidth: 1, borderLeftColor: "#000" }}>
              <Text style={styles.totalsBold} testID="commission-value">
                {Math.round(totals.comm).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={[styles.expenseRow, { borderBottomWidth: 0 }]}>
            <View style={styles.expenseLabel}>
              <Text style={styles.expenseLabelText}>खर्च टोटल</Text>
            </View>
            <View style={{ flex: 1, padding: 10, alignItems: "center", justifyContent: "center" }}>
              <Text style={styles.totalsBold} testID="kharch-total">
                {Math.round(totals.kharch).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* NET row */}
        <View style={styles.netRow}>
          <View style={styles.netLabel}>
            <Text style={styles.netText}>नेट</Text>
          </View>
          <View style={styles.netValue}>
            <Text style={styles.netText} testID="net-value">
              {Math.round(totals.net).toLocaleString()}
            </Text>
          </View>
        </View>

        <InvoiceExtras
          description={description}
          onDescription={setDescription}
          photoPath={photoPath}
          onPhoto={setPhotoPath}
          net={totals.net}
          {...(mode === "create"
            ? { paymentOut, onPaymentOut: setPaymentOut, paymentMode, onPaymentMode: setPaymentMode }
            : {})}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            testID="save-invoice-btn"
            style={styles.saveBtn}
            disabled={saving}
            onPress={() => (mode === "create" ? createMut.mutate() : updateMut.mutate())}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "सेव हो रहा है…" : mode === "create" ? "इनवॉइस सेव करें" : "अपडेट करें"}
            </Text>
          </TouchableOpacity>
          {mode === "edit" && Platform.OS === "web" && (
            <TouchableOpacity
              testID="export-footer-btn"
              style={styles.exportBtn}
              onPress={openExport}
            >
              <Text style={styles.exportBtnText}>Excel</Text>
            </TouchableOpacity>
          )}
        </View>
        {!!status && <Text style={styles.status}>{status}</Text>}

        {mode === "edit" && initial && (
          <View style={styles.editActionsWrap}>
            <PaymentSection
              invoiceId={initial.id}
              partyId={partyId}
              net={savedNet}
              payments={payments}
              onChange={(inv) => {
                setPayments(inv.payments ?? []);
                setSavedNet(inv.net);
              }}
            />

            {/* WhatsApp share */}
            <TouchableOpacity
              testID="whatsapp-share-btn"
              style={styles.waBtn}
              onPress={() => shareWhatsApp()}
            >
              <Text style={styles.waBtnText}>
                📱 WhatsApp par PDF bhejein
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                testID="open-pdf-btn"
                style={[styles.linkBtn, { flex: 1 }]}
                onPress={() => Linking.openURL(api.invoicePdfUrl(initial.id))}
              >
                <Text style={styles.linkBtnText}>📄 PDF dekhein</Text>
              </TouchableOpacity>
              {!!initial?.drive_file_url && (
                <TouchableOpacity
                  testID="open-drive-file-btn"
                  style={[styles.linkBtn, { flex: 1 }]}
                  onPress={() => Linking.openURL(initial.drive_file_url!)}
                >
                  <Text style={styles.linkBtnText}>Drive me kholein</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              testID="delete-invoice-btn"
              style={styles.deleteBtn}
              onPress={() => deleteMut.mutate()}
            >
              <Text style={styles.deleteBtnText}>इनवॉइस डिलीट करें</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
