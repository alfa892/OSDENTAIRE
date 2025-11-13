'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DateTime } from 'luxon';
import type { Role } from '../../lib/apiClient';
import { fetchPatients, type PatientListItem } from '../../lib/patientsApi';
import {
  fetchAgenda,
  createAppointment,
  cancelAppointment,
  fetchAppointmentUpdates,
  type AgendaResponse,
  type Appointment,
  type AppointmentEvent,
} from '../../lib/appointmentsApi';

const roleOptions: Role[] = ['assistant', 'practitioner', 'admin'];
const durationOptions = [15, 30, 45, 60, 90];
const PARIS_TZ = 'Europe/Paris';

type FormState = {
  patientId: string;
  providerId: string;
  roomId: string;
  date: string;
  time: string;
  duration: number;
  title: string;
};

const defaultWeekStart = () => DateTime.now().setZone(PARIS_TZ).startOf('week');

const applyEventsToAgenda = (agenda: AgendaResponse, events: AppointmentEvent[]) => {
  if (!events.length) return agenda;
  const rangeStart = DateTime.fromISO(agenda.meta.start).toMillis();
  const rangeEnd = DateTime.fromISO(agenda.meta.end).toMillis();
  let nextData = [...agenda.data];
  events.forEach((event) => {
    const idx = nextData.findIndex((item) => item.id === event.data.id);
    if (idx >= 0) {
      nextData[idx] = event.data;
      return;
    }
    const start = DateTime.fromISO(event.data.startAt).toMillis();
    if (start >= rangeStart && start < rangeEnd) {
      nextData = [...nextData, event.data];
    }
  });
  nextData.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return { ...agenda, data: nextData };
};

const formatHour = (value: string) =>
  DateTime.fromISO(value).setZone(PARIS_TZ).toLocaleString(DateTime.TIME_SIMPLE);

const formatDayLabel = (value: DateTime) => value.setZone(PARIS_TZ).toFormat('ccc dd/MM');

const highlightStatus = (appointment: Appointment) => {
  if (appointment.status === 'cancelled') return 'border-rose-400/50 bg-rose-500/10 text-rose-200';
  return 'border-emerald-400/30 bg-emerald-500/5 text-emerald-100';
};

export default function AgendaModule() {
  const [role, setRole] = useState<Role>('assistant');
  const [weekStart, setWeekStart] = useState<DateTime>(defaultWeekStart);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({
    patientId: '',
    providerId: '',
    roomId: '',
    date: weekStart.toISODate(),
    time: '09:00',
    duration: 30,
    title: 'Consultation',
  });

  const loadAgenda = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        const start = weekStart.toUTC().toISO();
        const end = weekStart.plus({ days: 7 }).toUTC().toISO();
        const data = await fetchAgenda({ start, end }, role, signal);
        setAgenda(data);
        setCursor(data.meta.cursor);
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Impossible de charger l\'agenda. Vérifie l\'API.');
        setAgenda(null);
      } finally {
        setLoading(false);
      }
    },
    [role, weekStart]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAgenda(controller.signal);
    return () => controller.abort();
  }, [loadAgenda]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetchPatients(role, controller.signal);
        setPatients(response.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setPatients([]);
      }
    })();
    return () => controller.abort();
  }, [role]);

  useEffect(() => {
    if (!agenda) return;
    setFormState((prev) => ({
      ...prev,
      providerId: prev.providerId || agenda.providers[0]?.id || '',
      roomId: prev.roomId || agenda.rooms[0]?.id || '',
      date: prev.date || DateTime.fromISO(agenda.meta.start).toISODate(),
    }));
  }, [agenda]);

  useEffect(() => {
    if (!cursor) return;
    const controller = new AbortController();
    let active = true;

    const loop = async (currentCursor: number) => {
      try {
        const update = await fetchAppointmentUpdates(currentCursor, role, controller.signal);
        if (!active) return;
        if (update.events.length) {
          setAgenda((prev) => (prev ? applyEventsToAgenda(prev, update.events) : prev));
          setCursor(update.cursor);
        } else {
          loop(update.cursor);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError' || !active) return;
        setTimeout(() => loop(currentCursor), 2000);
      }
    };

    loop(cursor);

    return () => {
      active = false;
      controller.abort();
    };
  }, [cursor, role]);

  const handleShiftWeek = (direction: -1 | 1) => {
    setWeekStart((prev) => prev.plus({ weeks: direction }));
    setCursor(0);
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: field === 'duration' ? Number(value) : value }));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.patientId || !formState.providerId || !formState.roomId || !formState.date) {
      setError('Sélectionne un patient, un praticien, une salle et une date.');
      return;
    }

    try {
      setCreating(true);
      const start = DateTime.fromISO(`${formState.date}T${formState.time}`, { zone: PARIS_TZ }).toISO();
      if (!start) {
        setError('Format de date invalide.');
        return;
      }
      await createAppointment(
        {
          providerId: formState.providerId,
          roomId: formState.roomId,
          patientId: formState.patientId,
          title: formState.title || 'Consultation',
          startAt: start,
          durationMinutes: formState.duration,
        },
        role
      );
      setFormState((prev) => ({ ...prev, title: 'Consultation', patientId: '' }));
      await loadAgenda();
    } catch {
      setError('Créneau indisponible ou droits insuffisants.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    try {
      setCancelling(appointmentId);
      await cancelAppointment(appointmentId, { reason: 'Annulé depuis l\'agenda web' }, role);
      await loadAgenda();
    } catch {
      setError('Annulation impossible (RBAC ou serveur).');
    } finally {
      setCancelling(null);
    }
  };

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => weekStart.plus({ days: index })), [weekStart]);

  const appointmentsByProvider = useMemo(() => {
    if (!agenda) return new Map<string, Record<string, Appointment[]>>();
    const map = new Map<string, Record<string, Appointment[]>>();
    agenda.data.forEach((appointment) => {
      const providerId = appointment.provider.id;
      const dayKey = DateTime.fromISO(appointment.startAt).setZone(PARIS_TZ).toISODate();
      const currentByDay = map.get(providerId) ?? {};
      const dayAppointments = currentByDay[dayKey] ?? [];
      currentByDay[dayKey] = [...dayAppointments, appointment].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
      map.set(providerId, currentByDay);
    });
    return map;
  }, [agenda]);

  const weekLabel = `${weekStart.toFormat('dd MMM')} → ${weekStart.plus({ days: 4 }).toFormat('dd MMM')}`;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Module agenda</p>
            <h1 className="text-3xl font-semibold">Semaine opératoire & disponibilités</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
            {roleOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-full px-3 py-1 capitalize ${
                  role === option ? 'bg-emerald-400 text-emerald-950' : 'text-slate-100'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Semaine affichée</p>
            <p className="text-2xl font-semibold text-white">{weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Semaine -1
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(defaultWeekStart())}
              className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
            >
              Cette semaine
            </button>
            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Semaine +1
            </button>
          </div>
        </section>

        {error ? (
          <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            {loading ? (
              <p className="text-sm text-slate-300">Chargement de l&apos;agenda...</p>
            ) : agenda ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                  {agenda.providers.map((provider) => (
                    <div key={provider.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="font-semibold text-white">{provider.fullName}</p>
                      <p className="text-xs text-slate-300">
                        Prochain créneau :{' '}
                        {provider.nextAvailableAt
                          ? DateTime.fromISO(provider.nextAvailableAt).setZone(PARIS_TZ).toRelative()
                          : 'disponible'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${agenda.providers.length || 1}, minmax(220px, 1fr))` }}
                  >
                    {agenda.providers.map((provider) => (
                      <div key={provider.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                        <header className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm uppercase text-slate-400">{provider.specialty ?? provider.role}</p>
                            <p className="text-lg font-semibold" style={{ color: provider.color }}>
                              {provider.fullName}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                            {provider.initials}
                          </span>
                        </header>
                        <div className="space-y-3">
                          {days.map((day) => {
                            const dayKey = day.toISODate();
                            const list = appointmentsByProvider.get(provider.id)?.[dayKey] ?? [];
                            return (
                              <div key={dayKey} className="rounded-xl border border-white/5 bg-white/5 p-2">
                                <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                                  {formatDayLabel(day)}
                                </p>
                                {list.length === 0 ? (
                                  <p className="text-xs text-slate-500">Aucun rendez-vous.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {list.map((appointment) => (
                                      <div
                                        key={appointment.id}
                                        className={`rounded-xl border px-3 py-2 text-sm ${highlightStatus(appointment)}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <p className="font-semibold text-white">
                                            {formatHour(appointment.startAt)} · {appointment.title}
                                          </p>
                                          {appointment.status === 'scheduled' && role !== 'assistant' ? (
                                            <button
                                              type="button"
                                              onClick={() => handleCancel(appointment.id)}
                                              disabled={cancelling === appointment.id}
                                              className="text-xs text-rose-200 hover:text-rose-100"
                                            >
                                              {cancelling === appointment.id ? '...' : 'Annuler'}
                                            </button>
                                          ) : null}
                                        </div>
                                        <p className="text-xs text-slate-200">{appointment.patient.fullName}</p>
                                        <p className="text-xs text-slate-400">Salle {appointment.room.name}</p>
                                        {appointment.status === 'cancelled' && appointment.cancelReason ? (
                                          <p className="text-xs text-rose-200">{appointment.cancelReason}</p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-300">Aucune donnée agenda.</p>
            )}
          </div>

          <div className="space-y-4">
            <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <header>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Nouveau rendez-vous</p>
                <h2 className="text-xl font-semibold">Ajouter un créneau</h2>
              </header>
              <div className="space-y-3 text-sm">
                <label className="block">
                  <span className="text-slate-300">Patient</span>
                  <select
                    value={formState.patientId}
                    onChange={(event) => handleFormChange('patientId', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-300">Praticien</span>
                  <select
                    value={formState.providerId}
                    onChange={(event) => handleFormChange('providerId', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                    required
                  >
                    <option value="">Choisir</option>
                    {agenda?.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-300">Salle</span>
                  <select
                    value={formState.roomId}
                    onChange={(event) => handleFormChange('roomId', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                    required
                  >
                    <option value="">Choisir</option>
                    {agenda?.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-300">Titre</span>
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => handleFormChange('title', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-slate-300">Date</span>
                    <input
                      type="date"
                      value={formState.date}
                      onChange={(event) => handleFormChange('date', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-300">Heure</span>
                    <input
                      type="time"
                      value={formState.time}
                      onChange={(event) => handleFormChange('time', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                      step={900}
                      required
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-slate-300">Durée (minutes)</span>
                  <select
                    value={formState.duration}
                    onChange={(event) => handleFormChange('duration', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 p-2"
                  >
                    {durationOptions.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-full bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-300"
              >
                {creating ? 'Création...' : 'Ajouter le RDV'}
              </button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Salles</p>
              <div className="space-y-2">
                {agenda?.rooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between">
                    <span className="font-medium text-white">{room.name}</span>
                    <span className="text-xs text-slate-400">{room.equipment ?? room.floor ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
