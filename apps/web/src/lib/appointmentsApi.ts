import { API_BASE, buildHeaders, handleResponse, type Role } from './apiClient';

export type AppointmentNote = {
  id: string;
  authorRole: string;
  authorName: string;
  kind: 'note' | 'notification';
  body: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  status: 'scheduled' | 'cancelled';
  timezone: string;
  startAt: string;
  endAt: string;
  slotMinutes: number;
  provider: { id: string; fullName: string; initials: string; color: string };
  room: { id: string; name: string; color: string };
  patient: { id: string; fullName: string; reference: string };
  cancelReason: string | null;
  canceledAt: string | null;
  createdBy: string;
  createdByRole: string;
  notes: AppointmentNote[];
};

export type ProviderSummary = {
  id: string;
  fullName: string;
  initials: string;
  specialty: string | null;
  role: string;
  color: string;
  nextAvailableAt: string | null;
};

export type RoomSummary = {
  id: string;
  name: string;
  color: string;
  floor: string | null;
  equipment: string | null;
};

export type AgendaResponse = {
  data: Appointment[];
  providers: ProviderSummary[];
  rooms: RoomSummary[];
  meta: { start: string; end: string; timezone: string; cursor: number };
};

export type AppointmentEvent = {
  type: 'appointment.created' | 'appointment.cancelled';
  data: Appointment;
  cursor: number;
};

export const fetchAgenda = async (
  params: { start?: string; end?: string; includeNotes?: boolean },
  role: Role,
  signal?: AbortSignal
) => {
  const query = new URLSearchParams();
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);
  if (params.includeNotes) query.set('includeNotes', 'true');
  const queryString = query.toString();
  const url = queryString ? `${API_BASE}/api/appointments?${queryString}` : `${API_BASE}/api/appointments`;

  const res = await fetch(url, {
    headers: buildHeaders(role),
    cache: 'no-store',
    signal,
  });
  return handleResponse<AgendaResponse>(res);
};

export const createAppointment = async (
  payload: { providerId: string; roomId: string; patientId: string; title: string; startAt: string; durationMinutes?: number },
  role: Role
) => {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: 'POST',
    headers: buildHeaders(role),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ data: Appointment }>(res);
};

export const cancelAppointment = async (
  id: string,
  payload: { reason?: string },
  role: Role
) => {
  const res = await fetch(`${API_BASE}/api/appointments/${id}/cancel`, {
    method: 'PATCH',
    headers: buildHeaders(role),
    body: JSON.stringify(payload ?? {}),
  });
  return handleResponse<{ data: Appointment }>(res);
};

export const fetchAppointmentUpdates = async (cursor: number, role: Role, signal?: AbortSignal) => {
  const url = `${API_BASE}/api/appointments/updates?cursor=${cursor}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(role),
    signal,
  });
  return handleResponse<{ events: AppointmentEvent[]; cursor: number }>(res);
};
