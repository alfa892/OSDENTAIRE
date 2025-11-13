import { API_BASE, buildHeaders, handleResponse, type Role } from './apiClient';

export type { Role } from './apiClient';

const defaultHeaders = buildHeaders;

export type PatientListItem = {
  id: string;
  reference: string;
  fullName: string;
  status: 'active' | 'archived';
  activeTreatment: string | null;
  nextVisit: string | null;
  balance: number;
  primaryContact: { label: string; value: string } | null;
  pendingConsents: number;
};

export type PatientDetail = {
  id: string;
  reference: string;
  fullName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  activeTreatment: string | null;
  status: 'active' | 'archived';
  nextVisit: string | null;
  balance: number;
  notes: string | null;
  contacts: Array<{ id: string; type: string; label: string; value: string; isPrimary: boolean }>;
  consentForms: Array<{ id: string; template: string; status: string; signedAt: string | null; fileUrl: string | null }>;
};

export type PatientListResponse = {
  data: PatientListItem[];
  meta: { total: number; limit: number; offset: number };
};

export type CreatePatientInput = {
  fullName: string;
  preferredName?: string;
  email?: string;
  phone: string;
  activeTreatment?: string;
  nextVisit?: string;
  balance?: number;
  notes?: string;
  contacts: Array<{ type: 'phone' | 'email' | 'emergency'; label: string; value: string; isPrimary?: boolean }>;
  consentForms?: Array<{ template: string; status?: 'pending' | 'signed'; signedAt?: string }>;
};

export const fetchPatients = async (role: Role, signal?: AbortSignal) => {
  const res = await fetch(`${API_BASE}/api/patients`, {
    method: 'GET',
    headers: defaultHeaders(role),
    cache: 'no-store',
    signal,
  });
  return handleResponse<PatientListResponse>(res);
};

export const fetchPatient = async (id: string, role: Role, signal?: AbortSignal) => {
  const res = await fetch(`${API_BASE}/api/patients/${id}`, {
    method: 'GET',
    headers: defaultHeaders(role),
    cache: 'no-store',
    signal,
  });
  return handleResponse<{ data: PatientDetail }>(res);
};

export const createPatient = async (payload: CreatePatientInput, role: Role) => {
  const res = await fetch(`${API_BASE}/api/patients`, {
    method: 'POST',
    headers: defaultHeaders(role),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ data: PatientDetail }>(res);
};

export const archivePatient = async (id: string, role: Role) => {
  const res = await fetch(`${API_BASE}/api/patients/${id}`, {
    method: 'DELETE',
    headers: defaultHeaders(role),
  });
  await handleResponse<unknown>(res);
};
