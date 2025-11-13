'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Role } from '../../lib/apiClient';
import {
  createInvoice,
  fetchInvoice,
  fetchInvoices,
  recordPayment,
  type CreateInvoiceInput,
  type InvoiceDetail,
  type InvoiceListItem,
  type RecordPaymentInput,
} from '../../lib/invoicesApi';
import { fetchPatients, type PatientListItem } from '../../lib/patientsApi';

const roleOptions: Role[] = ['practitioner', 'admin'];
const euro = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
const formatDate = (value: string) => new Date(value).toLocaleDateString('fr-FR');
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const emptyCreateForm = {
  patientId: '',
  description: '',
  amount: '',
  dueDate: '',
  issueNow: true,
};

const emptyPaymentForm = {
  amount: '',
  method: 'card',
  source: 'patient' as RecordPaymentInput['source'],
};

type CreateFormState = typeof emptyCreateForm;
type PaymentFormState = typeof emptyPaymentForm;

export default function FacturationModule() {
  const [role, setRole] = useState<Role>('practitioner');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'issued' | 'paid'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [patientOptions, setPatientOptions] = useState<PatientListItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchInvoices(role, { status: statusFilter }, controller.signal)
      .then((response) => {
        setInvoices(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
        } else {
          setSelectedId(null);
          setSelectedDetail(null);
        }
        setError(null);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError('Impossible de récupérer les factures (API).');
        setInvoices([]);
        setSelectedDetail(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [role, statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetailLoading(true);
    fetchInvoice(role, selectedId, controller.signal)
      .then((res) => {
        setSelectedDetail(res.data);
        setPaymentForm((prev) => ({ ...prev, amount: res.data.totals.balance.toString() }));
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setSelectedDetail(null);
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [selectedId, role]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPatients(role, controller.signal)
      .then((response) => {
        setPatientOptions(response.data);
        if (response.data.length > 0) {
          setCreateForm((prev) => ({ ...prev, patientId: prev.patientId || response.data[0].id }));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [role]);

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedId) ?? null, [invoices, selectedId]);

  const handleCreateInvoice = async () => {
    if (!createForm.patientId || !createForm.description || !createForm.amount || !createForm.dueDate) return;
    setCreating(true);
    try {
      const payload: CreateInvoiceInput = {
        patientId: createForm.patientId,
        description: createForm.description,
        amount: Number(createForm.amount),
        dueDate: new Date(createForm.dueDate).toISOString(),
        issueNow: createForm.issueNow,
      };
      const created = await createInvoice(role, payload);
      setCreateModalOpen(false);
      setCreateForm(emptyCreateForm);
      await refreshInvoices(created.data.id);
    } catch (err) {
      console.error(err);
      setError('Création facture impossible.');
    } finally {
      setCreating(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedDetail) return;
    if (!paymentForm.amount) return;
    setPaying(true);
    try {
      const payload: RecordPaymentInput = {
        invoiceId: selectedDetail.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        source: paymentForm.source,
      };
      await recordPayment(role, payload);
      setPaymentModalOpen(false);
      setPaymentForm(emptyPaymentForm);
      await refreshInvoices(selectedDetail.id);
    } catch (err) {
      console.error(err);
      setError('Paiement refusé.');
    } finally {
      setPaying(false);
    }
  };

  const refreshInvoices = async (selectId?: string) => {
    const response = await fetchInvoices(role, { status: statusFilter });
    setInvoices(response.data);
    if (selectId) {
      setSelectedId(selectId);
    } else if (response.data.length > 0) {
      setSelectedId(response.data[0].id);
    }
  };

  const openCreateModal = () => {
    setCreateModalOpen(true);
    setCreateForm((prev) => ({
      patientId: patientOptions[0]?.id ?? prev.patientId,
      description: '',
      amount: '',
      dueDate: new Date().toISOString().slice(0, 16),
      issueNow: true,
    }));
  };

  const openPaymentModal = () => {
    if (!selectedDetail) return;
    setPaymentForm({
      amount: selectedDetail.totals.balance.toString(),
      method: 'card',
      source: 'patient',
    });
    setPaymentModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Module facturation</p>
            <h1 className="text-3xl font-semibold">Factures, paiements patient/mutuelle & PDF</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
            {roleOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-full px-3 py-1 capitalize ${role === option ? 'bg-emerald-400 text-emerald-950' : 'text-slate-100'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {(['all', 'draft', 'issued', 'paid'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${
                  statusFilter === status ? 'bg-white/20' : 'border border-white/10'
                }`}
              >
                {status === 'all' ? 'Tous' : status}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950"
            >
              Nouvelle facture
            </button>
            <button
              type="button"
              onClick={openPaymentModal}
              disabled={!selectedDetail}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Enregistrer un paiement
            </button>
          </div>
        </div>

        {error && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section className="rounded-2xl border border-white/10 bg-slate-900/60">
            <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 text-sm text-slate-400">
              <span>{loading ? 'Chargement…' : `${invoices.length} facture(s)`}</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Réf</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Payeur</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Échéance</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${
                        selectedId === invoice.id ? 'bg-white/10' : ''
                      }`}
                      onClick={() => setSelectedId(invoice.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{invoice.reference}</td>
                      <td className="px-4 py-3">{invoice.patient.fullName}</td>
                      <td className="px-4 py-3 text-slate-300">{invoice.payer.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            invoice.status === 'paid'
                              ? 'bg-emerald-400/20 text-emerald-200'
                              : invoice.status === 'issued'
                              ? 'bg-amber-400/20 text-amber-200'
                              : 'bg-slate-500/30 text-slate-200'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3 text-right">{euro(invoice.total)}</td>
                      <td className="px-4 py-3 text-right">{euro(invoice.balance)}</td>
                    </tr>
                  ))}
                  {!loading && invoices.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
                        Aucune facture pour le filtre sélectionné.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            {detailLoading && <p className="text-sm text-slate-400">Chargement...</p>}
            {!detailLoading && selectedDetail && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Facture</p>
                  <h2 className="text-2xl font-semibold">{selectedDetail.reference}</h2>
                  <p className="text-sm text-slate-400">Échéance {formatDate(selectedDetail.dueDate)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-white/5 p-4 text-sm">
                  <div>
                    <p className="text-slate-400">Patient</p>
                    <p className="font-semibold">{selectedDetail.patient.fullName}</p>
                    <p className="text-xs text-slate-400">{selectedDetail.patient.reference}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Payeur</p>
                    <p className="font-semibold">{selectedDetail.payer.name}</p>
                    <p className="text-xs text-slate-400">{selectedDetail.payer.email ?? '—'}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total TTC</span>
                    <span className="font-semibold">{euro(selectedDetail.totals.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Réglé</span>
                    <span>{euro(selectedDetail.totals.paid)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Solde</span>
                    <span>{euro(selectedDetail.totals.balance)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Actes</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {selectedDetail.items.map((item) => (
                      <li key={item.id} className="flex justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-slate-400">
                            {item.quantity} × {euro(item.unitPrice)} · TVA {Math.round(item.taxRate * 100)}%
                          </p>
                        </div>
                        <span>{euro(item.totalInclTax)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paiements</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {selectedDetail.payments.length === 0 && <li>Aucun paiement enregistré.</li>}
                    {selectedDetail.payments.map((payment) => (
                      <li key={payment.id} className="flex justify-between rounded px-2 py-1">
                        <span>
                          {payment.source} · {payment.method} · {formatDateTime(payment.paidAt)}
                        </span>
                        <span className="font-semibold">{euro(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {selectedDetail.pdfUrl && (
                  <a
                    href={selectedDetail.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Télécharger le PDF
                  </a>
                )}
              </div>
            )}
            {!detailLoading && !selectedDetail && <p className="text-sm text-slate-400">Sélectionne une facture.</p>}
          </aside>
        </div>
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-sm">
            <h3 className="text-lg font-semibold">Nouvelle facture</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-slate-300">
                Patient
                <select
                  value={createForm.patientId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, patientId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  {patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-slate-300">
                Description
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                />
              </label>
              <label className="block text-slate-300">
                Montant TTC (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                />
              </label>
              <label className="block text-slate-300">
                Échéance
                <input
                  type="datetime-local"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={createForm.issueNow}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, issueNow: e.target.checked }))}
                />
                Émettre immédiatement (PDF)
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={creating}
                className="rounded-full bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 disabled:opacity-50"
              >
                {creating ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModalOpen && selectedDetail && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-sm">
            <h3 className="text-lg font-semibold">Paiement · {selectedDetail.reference}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-slate-300">
                Montant (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                />
              </label>
              <label className="block text-slate-300">
                Méthode
                <input
                  type="text"
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                />
              </label>
              <label className="block text-slate-300">
                Source
                <select
                  value={paymentForm.source}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, source: e.target.value as RecordPaymentInput['source'] }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <option value="patient">Patient</option>
                  <option value="mutuelle">Mutuelle</option>
                  <option value="insurance">Assureur</option>
                  <option value="other">Autre</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePayment}
                disabled={paying}
                className="rounded-full bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 disabled:opacity-50"
              >
                {paying ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
