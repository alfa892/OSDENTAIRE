'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  archivePatient,
  createPatient,
  fetchPatient,
  fetchPatients,
  type CreatePatientInput,
  type PatientDetail,
  type PatientListItem,
  type Role,
} from '../../lib/patientsApi';

const roleOptions: Role[] = ['assistant', 'practitioner', 'admin'];

const initialForm = {
  fullName: '',
  preferredName: '',
  email: '',
  phone: '',
  activeTreatment: '',
  nextVisit: '',
  notes: '',
  emergencyName: '',
  emergencyPhone: '',
  consentTemplate: 'Consentement soins dentaires',
};

type FormState = typeof initialForm;

const formatDate = (value: string | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const euro = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;

export default function PatientsModule() {
  const [role, setRole] = useState<Role>('assistant');
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PatientDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const refreshPatients = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const response = await fetchPatients(role, signal);
        setPatients(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
        } else {
          setSelectedId(null);
          setSelectedDetail(null);
        }
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('API patients injoignable. Réessaie dans quelques secondes.');
        setPatients([]);
        setSelectedDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [role]
  );

  useEffect(() => {
    const controller = new AbortController();
    refreshPatients(controller.signal);
    return () => controller.abort();
  }, [refreshPatients]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetchPatient(selectedId, role, controller.signal);
        setSelectedDetail(response.data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSelectedDetail(null);
      }
    })();
    return () => controller.abort();
  }, [selectedId, role]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormState(initialForm);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload: CreatePatientInput = {
        fullName: formState.fullName,
        preferredName: formState.preferredName || undefined,
        email: formState.email || undefined,
        phone: formState.phone,
        activeTreatment: formState.activeTreatment || undefined,
        nextVisit: formState.nextVisit || undefined,
        notes: formState.notes || undefined,
        contacts: [
          { type: 'phone', label: 'Mobile', value: formState.phone, isPrimary: true },
          formState.email
            ? { type: 'email', label: 'Email', value: formState.email }
            : null,
          formState.emergencyName && formState.emergencyPhone
            ? { type: 'emergency', label: formState.emergencyName, value: formState.emergencyPhone }
            : null,
        ].filter(Boolean) as CreatePatientInput['contacts'],
        consentForms: [
          {
            template: formState.consentTemplate || 'Consentement soins dentaires',
            status: 'pending',
          },
        ],
      };

      const created = await createPatient(payload, role);
      setDrawerOpen(false);
      resetForm();
      await refreshPatients();
      setSelectedId(created.data.id);
    } catch (err) {
      console.error(err);
      setError('Création impossible (validation ou droits insuffisants).');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedId) return;
    setArchiving(true);
    try {
      await archivePatient(selectedId, role);
      await refreshPatients();
      setSelectedDetail(null);
      setSelectedId(null);
    } catch (err) {
      console.error(err);
      setError('Suppression réservée aux admins.');
    } finally {
      setArchiving(false);
    }
  };

  const selectedPatient = useMemo(() => patients.find((patient) => patient.id === selectedId) ?? null, [
    patients,
    selectedId,
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Module patients</p>
            <h1 className="text-3xl font-semibold">Dossiers, consentements et contacts critiques</h1>
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

        {error && <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{error}</p>}

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Patients</p>
                <p className="text-lg font-semibold">{patients.length} en base</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950"
                disabled={role === 'practitioner'}
              >
                Nouveau patient
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-widest text-slate-300">
                    <th className="px-3 py-2">Identité</th>
                    <th className="px-3 py-2">Traitement</th>
                    <th className="px-3 py-2">Prochain RDV</th>
                    <th className="px-3 py-2">Consentements</th>
                    <th className="px-3 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Chargement...
                      </td>
                    </tr>
                  )}
                  {!loading && patients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Aucun patient pour ce rôle.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    patients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`cursor-pointer border-t border-white/5 transition hover:bg-white/5 ${
                          selectedId === patient.id ? 'bg-white/10' : ''
                        }`}
                        onClick={() => setSelectedId(patient.id)}
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold">{patient.fullName}</p>
                          <p className="text-xs text-slate-300">{patient.primaryContact?.value ?? '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-200">{patient.activeTreatment ?? '—'}</td>
                        <td className="px-3 py-3 text-slate-200">{formatDate(patient.nextVisit)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs ${patient.pendingConsents ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                            {patient.pendingConsents ? `${patient.pendingConsents} en attente` : 'À jour'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{euro(patient.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            {selectedPatient && selectedDetail ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Fiche patient</p>
                  <h2 className="text-2xl font-semibold">{selectedDetail.fullName}</h2>
                  <p className="text-sm text-slate-300">{selectedDetail.reference}</p>
                </div>
                <div className="space-y-2 text-sm text-slate-200">
                  <p>
                    Statut :{' '}
                    <span className="font-semibold">
                      {selectedDetail.status === 'active' ? 'Actif' : 'Archivé'}
                    </span>
                  </p>
                  <p>Traitement : {selectedDetail.activeTreatment ?? '—'}</p>
                  <p>Prochain RDV : {formatDate(selectedDetail.nextVisit)}</p>
                  <p>Solde : {euro(selectedDetail.balance)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Contacts</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {selectedDetail.contacts.map((contact) => (
                      <li key={contact.id} className="flex items-center justify-between">
                        <span>
                          {contact.label}
                          {contact.isPrimary && (
                            <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
                              Primaire
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-emerald-100">{contact.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Consentements</p>
                  <div className="mt-2 space-y-2">
                    {selectedDetail.consentForms.map((consent) => (
                      <div
                        key={consent.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-semibold">{consent.template}</p>
                          <p className="text-xs text-slate-400">
                            {consent.signedAt ? `Signé le ${new Date(consent.signedAt).toLocaleDateString('fr-FR')}` : 'En attente'}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            consent.status === 'signed'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {consent.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {role === 'admin' && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiving}
                    className="w-full rounded-full border border-rose-400/40 px-4 py-2 text-sm text-rose-100 hover:bg-rose-500/10"
                  >
                    {archiving ? 'Archivage...' : 'Archiver & anonymiser plus tard'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-300">Sélectionne un patient dans la liste pour voir les détails.</p>
            )}
          </aside>
        </section>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setDrawerOpen(false)}>
          <div
            className="h-full w-full max-w-md translate-x-0 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Nouveau patient</p>
                <h3 className="text-2xl font-semibold">Formulaire express</h3>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-slate-400">
                ✕
              </button>
            </div>
            <form className="mt-6 flex flex-col gap-4" onSubmit={handleCreate}>
              <div>
                <label className="text-xs uppercase text-slate-300">Nom complet</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  value={formState.fullName}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-300">Prénom préféré</label>
                  <input
                    type="text"
                    name="preferredName"
                    value={formState.preferredName}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-300">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-300">Téléphone</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formState.phone}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-300">Prochain RDV</label>
                  <input
                    type="datetime-local"
                    name="nextVisit"
                    value={formState.nextVisit}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-slate-300">Traitement actif</label>
                <input
                  type="text"
                  name="activeTreatment"
                  value={formState.activeTreatment}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-300">Notes</label>
                <textarea
                  name="notes"
                  value={formState.notes}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-300">Contact urgence</label>
                  <input
                    type="text"
                    name="emergencyName"
                    value={formState.emergencyName}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-300">Téléphone urgence</label>
                  <input
                    type="tel"
                    name="emergencyPhone"
                    value={formState.emergencyPhone}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-slate-300">Consentement associé</label>
                <input
                  type="text"
                  name="consentTemplate"
                  value={formState.consentTemplate}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-emerald-400 px-4 py-2 text-base font-semibold text-emerald-950"
                >
                  {submitting ? 'Création...' : 'Enregistrer le patient'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setDrawerOpen(false);
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
