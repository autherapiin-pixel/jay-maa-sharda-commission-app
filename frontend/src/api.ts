// Lightweight REST client for the commission invoice backend.
// Base URL comes from EXPO_PUBLIC_BACKEND_URL (plus the /api prefix).

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

// In-memory session token (hydrated by AuthProvider from secure storage)
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as any) };
  if (!(init?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(BASE + path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {}
    if (res.status === 401 && authToken && !path.startsWith("/auth/")) onUnauthorized?.();
    throw new ApiError(res.status, msg || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Types
export type User = {
  user_id: string;
  email?: string | null;
  phone?: string | null;
  name: string;
  picture?: string | null;
  auth_provider: string;
};

export type AuthResponse = { session_token: string; user: User };

export type Settings = {
  id: string;
  shop_name: string;
  shop_tagline: string;
  shop_address: string;
  default_commission_percent: number;
  whatsapp_number?: string;
};

export type Party = {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  default_commission_percent?: number | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  created_at?: string;
};

export type InvoiceItem = {
  sr?: number | null;
  item: string;
  qty: number;
  rate: number;
  total: number;
};

export type Payment = {
  id: string;
  amount: number;
  date: string;
  mode: string;
  note?: string;
  created_at?: string;
};

export type PartyPayment = Payment & {
  invoice_id: string;
  invoice_date: string;
  invoice_net: number;
};

export type Invoice = {
  id: string;
  party_id: string;
  party_name: string;
  date: string;
  items: InvoiceItem[];
  sr_total?: number;
  items_total: number;
  bhada: number;
  mazdoori: number;
  commission_percent: number;
  commission: number;
  kharch_total: number;
  net: number;
  note?: string;
  description?: string;
  photo_path?: string | null;
  payments?: Payment[];
  paid_amount?: number;
  balance?: number;
  paid?: boolean;
  paid_at?: string | null;
  drive_file_id?: string | null;
  drive_file_url?: string | null;
  drive_pdf_id?: string | null;
  drive_pdf_url?: string | null;
  synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ItemMemory = {
  item: string;
  last_rate: number;
  last_qty: number;
  last_total: number;
  count: number;
};

export type DaybookRow = {
  period: string;
  invoices: number;
  items_total: number;
  bhada: number;
  mazdoori: number;
  commission: number;
  net: number;
  paid_net: number;
  pending_net: number;
};

export type PartySummary = {
  count: number;
  total_net: number;
  total_commission: number;
  pending_count: number;
  pending_net: number;
  paid_net: number;
};

export type ExcelImportResult = {
  parties_created: number;
  invoices_imported: number;
  invoices_skipped: number;
  warnings: string[];
};

export const api = {
  base: BASE,

  // auth
  exchangeSession: (session_id: string) =>
    request<AuthResponse>("/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }),
  register: (data: { identifier: string; password: string; name?: string; email?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (identifier: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  forgotPassword: (identifier: string) =>
    request<{ message: string; email_hint?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),
  resetPassword: (token: string, new_password: string) =>
    request<AuthResponse & { message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // files
  uploadPhoto: (form: FormData) =>
    request<{ path: string; size: number }>("/upload", { method: "POST", body: form }),
  importExcel: (form: FormData) =>
    request<ExcelImportResult>("/import/excel", { method: "POST", body: form }),
  fileUrl: (path: string) => `${BASE}/files/${path}?token=${authToken ?? ""}`,

  // settings
  getSettings: () => request<Settings>("/settings"),
  updateSettings: (data: Partial<Settings>) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // parties
  listParties: (q?: string) =>
    request<Party[]>(`/parties${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createParty: (data: Partial<Party>) =>
    request<Party>("/parties", { method: "POST", body: JSON.stringify(data) }),
  getParty: (id: string) => request<Party>(`/parties/${id}`),
  updateParty: (id: string, data: Partial<Party>) =>
    request<Party>(`/parties/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteParty: (id: string) =>
    request<{ ok: boolean }>(`/parties/${id}`, { method: "DELETE" }),

  // invoices
  listInvoices: (partyId?: string) =>
    request<Invoice[]>(`/invoices${partyId ? `?party_id=${partyId}` : ""}`),
  createInvoice: (data: Partial<Invoice>) =>
    request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  getInvoice: (id: string) => request<Invoice>(`/invoices/${id}`),
  updateInvoice: (id: string, data: Partial<Invoice>) =>
    request<Invoice>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (id: string) =>
    request<{ ok: boolean }>(`/invoices/${id}`, { method: "DELETE" }),

  // stats
  getStats: () =>
    request<{
      parties: number;
      invoices: number;
      total_net: number;
      total_commission: number;
      pending_net: number;
      pending_count: number;
      recent: Invoice[];
    }>("/stats"),

  // payment
  togglePayment: (id: string, paid: boolean) =>
    request<Invoice>(`/invoices/${id}/payment`, {
      method: "PUT",
      body: JSON.stringify({ paid }),
    }),
  addPayment: (
    id: string,
    data: { amount: number; date?: string; mode?: string; note?: string },
  ) =>
    request<Invoice>(`/invoices/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePayment: (id: string, paymentId: string) =>
    request<Invoice>(`/invoices/${id}/payments/${paymentId}`, { method: "DELETE" }),
  partyPayments: (partyId: string) =>
    request<PartyPayment[]>(`/parties/${partyId}/payments`),

  // item memory
  partyItems: (partyId: string) =>
    request<ItemMemory[]>(`/parties/${partyId}/items`),

  // per-party summary (incl. pending)
  partySummary: (partyId: string) =>
    request<PartySummary>(`/parties/${partyId}/summary`),

  // daybook
  daybook: (period: "day" | "month" = "day", frm?: string, to?: string) => {
    const q = new URLSearchParams({ period });
    if (frm) q.append("frm", frm);
    if (to) q.append("to", to);
    return request<{
      rows: DaybookRow[];
      totals: Omit<DaybookRow, "period">;
      period: string;
    }>(`/stats/daybook?${q.toString()}`);
  },

  // google
  getGoogleStatus: () =>
    request<{
      connected: boolean;
      email?: string;
      master_sheet_url?: string;
      updated_at?: string;
    }>("/oauth/google/status"),
  disconnectGoogle: () =>
    request<{ ok: boolean }>("/oauth/google/disconnect", { method: "POST" }),
  googleLoginUrl: () => `${BASE}/oauth/google/login?token=${authToken ?? ""}`,

  syncInvoice: (id: string) =>
    request<{ ok: boolean; drive_file_url?: string; drive_pdf_url?: string }>(`/invoices/${id}/sync`, {
      method: "POST",
    }),
  syncAll: () =>
    request<{ ok: boolean; synced: number; total: number }>(
      "/google/sync-all",
      { method: "POST" },
    ),

  // export links (opened in browser → token in query)
  invoiceExportUrl: (id: string) => `${BASE}/invoices/${id}/export?token=${authToken ?? ""}`,
  invoicePdfUrl: (id: string) => `${BASE}/invoices/${id}/pdf?token=${authToken ?? ""}`,
  publicPdfUrl: (id: string) => `${BASE}/public/invoices/${id}/pdf`,
  partyExportUrl: (id: string) => `${BASE}/parties/${id}/export?token=${authToken ?? ""}`,
};
