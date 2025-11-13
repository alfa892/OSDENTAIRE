import { API_BASE, buildHeaders, handleResponse, type Role } from './apiClient';

export type InvoiceListItem = {
  id: string;
  reference: string;
  status: 'draft' | 'issued' | 'paid';
  dueDate: string;
  total: number;
  balance: number;
  patient: { id: string; fullName: string };
  payer: { id: string; name: string; type: string };
  pdfUrl: string | null;
};

export type InvoiceDetail = {
  id: string;
  reference: string;
  status: 'draft' | 'issued' | 'paid';
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    paid: number;
    balance: number;
  };
  patient: { id: string; fullName: string; reference: string };
  payer: { id: string; name: string; type: string; email: string | null };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalExclTax: number;
    totalInclTax: number;
  }>;
  payments: Array<{
    id: string;
    source: 'patient' | 'mutuelle' | 'insurance' | 'other';
    method: string;
    reference: string | null;
    notes: string | null;
    amount: number;
    paidAt: string;
  }>;
  insuranceClaim: null | {
    id: string;
    status: string;
    coveragePercent: number;
    coveredAmount: number;
    claimNumber: string | null;
  };
  pdfUrl: string | null;
};

export type CreateInvoiceInput = {
  patientId: string;
  dueDate: string;
  description: string;
  amount: number;
  issueNow?: boolean;
};

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: string;
  source: 'patient' | 'mutuelle' | 'insurance' | 'other';
};

export const fetchInvoices = async (
  role: Role,
  params: { status?: 'all' | 'draft' | 'issued' | 'paid' } = {},
  signal?: AbortSignal
) => {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') {
    search.set('status', params.status);
  }
  const url = `${API_BASE}/api/invoices${search.toString() ? `?${search.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(role),
    cache: 'no-store',
    signal,
  });
  return handleResponse<{ data: InvoiceListItem[]; meta: { total: number; limit: number; offset: number } }>(res);
};

export const fetchInvoice = async (role: Role, id: string, signal?: AbortSignal) => {
  const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
    method: 'GET',
    headers: buildHeaders(role),
    cache: 'no-store',
    signal,
  });
  return handleResponse<{ data: InvoiceDetail }>(res);
};

export const createInvoice = async (role: Role, payload: CreateInvoiceInput) => {
  const body = {
    patientId: payload.patientId,
    dueDate: payload.dueDate,
    items: [{ description: payload.description, quantity: 1, unitPrice: payload.amount }],
    issueNow: payload.issueNow ?? true,
  };
  const res = await fetch(`${API_BASE}/api/invoices`, {
    method: 'POST',
    headers: buildHeaders(role),
    body: JSON.stringify(body),
  });
  return handleResponse<{ data: InvoiceDetail }>(res);
};

export const recordPayment = async (role: Role, payload: RecordPaymentInput) => {
  const res = await fetch(`${API_BASE}/api/invoices/${payload.invoiceId}/payments`, {
    method: 'POST',
    headers: buildHeaders(role),
    body: JSON.stringify({
      amount: payload.amount,
      method: payload.method,
      source: payload.source,
    }),
  });
  return handleResponse<{ data: InvoiceDetail }>(res);
};
