import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { api, Invoice, Payment } from "@/src/api";
import { makeStyles } from "@/src/theme";

const MODES: { key: string; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "bank", label: "Bank" },
  { key: "cheque", label: "Cheque" },
];

export function modeLabel(mode: string) {
  return MODES.find((m) => m.key === mode)?.label ?? mode;
}

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
  },
  title: { fontSize: 14, fontWeight: "800", color: c.onSurface, marginBottom: 10 },
  summaryRow: { flexDirection: "row", gap: 8 },
  sumBox: {
    flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: c.surfaceTertiary,
  },
  sumLabel: { fontSize: 11, color: c.muted, fontWeight: "700" },
  sumValue: { fontSize: 15, fontWeight: "900", color: c.onSurface, marginTop: 2 },
  sumReceived: { backgroundColor: "#DCFCE7" },
  sumPending: { backgroundColor: "#FEE2E2" },

  payRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  payAmt: { fontSize: 15, fontWeight: "900", color: c.success, width: 90 },
  payMeta: { flex: 1 },
  payDate: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  payNote: { fontSize: 12, color: c.muted, marginTop: 1 },
  payDel: { padding: 8 },
  payDelText: { color: c.error, fontWeight: "800", fontSize: 13 },
  emptyText: { color: c.muted, fontSize: 13, marginTop: 10, textAlign: "center" },

  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  addBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: c.brandPrimary,
  },
  addBtnText: { color: c.onBrandPrimary, fontWeight: "800" },
  fullBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    borderWidth: 1.5, borderColor: c.success, backgroundColor: "#DCFCE7",
  },
  fullBtnText: { color: "#166534", fontWeight: "800" },
  paidBanner: {
    marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: "#DCFCE7",
  },
  paidBannerText: { color: "#166534", fontWeight: "800" },

  form: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.brandSecondary,
    gap: 8,
  },
  label: { fontSize: 11, fontWeight: "700", color: c.onBrandTertiary },
  input: {
    backgroundColor: c.surfaceSecondary, borderRadius: 8, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: c.onSurface,
  },
  twoCol: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  modeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  modeChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: c.brandSecondary, backgroundColor: c.surfaceSecondary,
  },
  modeChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  modeChipText: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  modeChipTextActive: { color: c.onBrandPrimary },
  formActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  saveBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: "center",
    backgroundColor: c.success,
  },
  saveBtnText: { color: c.onSuccess, fontWeight: "800" },
  cancelBtn: {
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 8, alignItems: "center",
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary,
  },
  cancelBtnText: { color: c.muted, fontWeight: "700" },
  errText: { color: c.error, fontSize: 12 },
}));

type Props = {
  invoiceId: string;
  partyId: string;
  net: number;
  payments: Payment[];
  onChange: (inv: Invoice) => void;
};

export function PaymentSection({ invoiceId, partyId, net, payments, onChange }: Props) {
  const styles = useStyles();
  const qc = useQueryClient();

  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(Math.round((net - paidAmount) * 100) / 100, 0);
  const fullyPaid = net - paidAmount <= 0.005;

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState("cash");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  function refresh(inv: Invoice) {
    onChange(inv);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["party-summary", partyId] });
    qc.invalidateQueries({ queryKey: ["party-payments", partyId] });
  }

  const addMut = useMutation({
    mutationFn: () =>
      api.addPayment(invoiceId, {
        amount: Number(amount),
        date: date.trim() || undefined,
        mode,
        note: note.trim(),
      }),
    onSuccess: (inv) => {
      refresh(inv);
      setShowForm(false);
      setAmount("");
      setNote("");
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  const fullMut = useMutation({
    mutationFn: () => api.togglePayment(invoiceId, true),
    onSuccess: refresh,
  });

  const delMut = useMutation({
    mutationFn: (paymentId: string) => api.deletePayment(invoiceId, paymentId),
    onSuccess: refresh,
  });

  function openForm() {
    setAmount(balance > 0 ? String(balance) : "");
    setDate(todayISO());
    setMode("cash");
    setNote("");
    setErr("");
    setShowForm(true);
  }

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErr("सही amount डालें");
      return;
    }
    addMut.mutate();
  }

  const sorted = [...payments].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <View style={styles.card} testID="payment-section">
      <Text style={styles.title}>💰 Payment Record</Text>

      <View style={styles.summaryRow}>
        <View style={styles.sumBox}>
          <Text style={styles.sumLabel}>नेट</Text>
          <Text style={styles.sumValue}>₹{Math.round(net).toLocaleString()}</Text>
        </View>
        <View style={[styles.sumBox, styles.sumReceived]}>
          <Text style={[styles.sumLabel, { color: "#166534" }]}>मिला (Received)</Text>
          <Text style={[styles.sumValue, { color: "#166534" }]} testID="payment-received">
            ₹{Math.round(paidAmount).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.sumBox, fullyPaid ? styles.sumReceived : styles.sumPending]}>
          <Text style={[styles.sumLabel, { color: fullyPaid ? "#166534" : "#991B1B" }]}>बाकी</Text>
          <Text
            style={[styles.sumValue, { color: fullyPaid ? "#166534" : "#991B1B" }]}
            testID="payment-balance"
          >
            ₹{Math.round(balance).toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>अभी कोई payment नहीं आया</Text>
        ) : (
          sorted.map((p) => (
            <View key={p.id} style={styles.payRow} testID={`payment-row-${p.id}`}>
              <Text style={styles.payAmt}>₹{Math.round(p.amount).toLocaleString()}</Text>
              <View style={styles.payMeta}>
                <Text style={styles.payDate}>
                  {p.date} • {modeLabel(p.mode)}
                </Text>
                {!!p.note && <Text style={styles.payNote}>{p.note}</Text>}
              </View>
              <TouchableOpacity
                testID={`payment-delete-${p.id}`}
                style={styles.payDel}
                disabled={delMut.isPending}
                onPress={() => delMut.mutate(p.id)}
              >
                <Text style={styles.payDelText}>हटाएँ</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {fullyPaid && net > 0 && !showForm && (
        <View style={styles.paidBanner} testID="payment-paid-banner">
          <Text style={styles.paidBannerText}>✓ पूरा Payment मिल गया</Text>
        </View>
      )}

      {!showForm && !fullyPaid && (
        <View style={styles.actions}>
          <TouchableOpacity testID="add-payment-btn" style={styles.addBtn} onPress={openForm}>
            <Text style={styles.addBtnText}>+ Payment जोड़ें</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="mark-full-paid-btn"
            style={styles.fullBtn}
            disabled={fullMut.isPending}
            onPress={() => fullMut.mutate()}
          >
            <Text style={styles.fullBtnText}>पूरा Paid</Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && (
        <View style={styles.form} testID="payment-form">
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                testID="payment-amount-input"
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                autoFocus
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                testID="payment-date-input"
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="yyyy-mm-dd"
              />
            </View>
          </View>
          <Text style={styles.label}>Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  testID={`payment-mode-${m.key}`}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setMode(m.key)}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            testID="payment-note-input"
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="जैसे: Ramu ke haath bheja"
          />
          {!!err && <Text style={styles.errText}>{err}</Text>}
          <View style={styles.formActions}>
            <TouchableOpacity
              testID="payment-save-btn"
              style={styles.saveBtn}
              disabled={addMut.isPending}
              onPress={submit}
            >
              <Text style={styles.saveBtnText}>{addMut.isPending ? "सेव…" : "Payment सेव करें"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="payment-cancel-btn"
              style={styles.cancelBtn}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.cancelBtnText}>रद्द</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
