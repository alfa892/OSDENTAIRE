import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './utils/testDb';
import { createPatientService } from '../src/services/patientService';
import { createInvoiceService } from '../src/services/invoiceService';
import { createInMemoryInvoiceStorage } from '../src/services/invoiceStorage';
import { createMemoryMailer } from '../src/services/invoiceMailer';

const pdfBuffer = async () => Buffer.from('pdf');

describe('invoiceService', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let patientId: string;

  beforeEach(async () => {
    ctx = await createTestDb();
    const patientService = createPatientService(ctx.database);
    const created = await patientService.create({
      fullName: 'Patient Facturation',
      phone: '+33 6 22 33 44 55',
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 22 33 44 55', isPrimary: true }],
    });
    patientId = created.id;
  });

  afterEach(async () => {
    await ctx.close();
  });

  const buildService = () => {
    const storage = createInMemoryInvoiceStorage();
    const mailer = createMemoryMailer();
    const service = createInvoiceService(ctx.database, {
      storage,
      mailer,
      pdfGenerator: pdfBuffer,
      taxRate: 0.2,
    });
    return { service, storage, mailer };
  };

  it('creates and issues an invoice with pdf + items', async () => {
    const { service, storage } = buildService();
    const invoice = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [
        { description: 'Détartrage', quantity: 1, unitPrice: 120 },
        { description: 'Radio', quantity: 1, unitPrice: 45 },
      ],
      issueNow: true,
    });

    expect(invoice).toBeTruthy();
    expect(invoice?.status).toBe('issued');
    expect(invoice?.totals.total).toBeGreaterThan(0);
    expect(invoice?.pdfUrl).toBeTruthy();
    expect(storage.dump().size).toBe(1);
  });

  it('adds extra items and recomputes totals', async () => {
    const { service } = buildService();
    const created = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Couronne', quantity: 1, unitPrice: 600 }],
      issueNow: true,
    });
    const updated = await service.addItems(created!.id, {
      items: [{ description: 'Anesthésie', quantity: 1, unitPrice: 80 }],
    });

    expect(updated?.items.length).toBe(2);
    expect(updated?.totals.total).toBeGreaterThan(created!.totals.total);
  });

  it('records payment and marks invoice as paid', async () => {
    const { service } = buildService();
    const created = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Traitement Invisalign', quantity: 1, unitPrice: 1500 }],
      issueNow: true,
    });

    const paid = await service.addPayment(created!.id, {
      amount: created!.totals.total,
      method: 'card',
      source: 'patient',
    });

    expect(paid?.status).toBe('paid');
    expect(paid?.totals.balance).toBe(0);
  });

  it('lists invoices filtered by status', async () => {
    const { service } = buildService();
    await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Soins', quantity: 1, unitPrice: 100 }],
      issueNow: true,
    });

    const list = await service.list({ status: 'issued' });
    expect(list.data.length).toBe(1);
    expect(list.data[0].status).toBe('issued');
  });

  it('persists insurance claims with dedicated payer', async () => {
    const { service } = buildService();
    const invoice = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Implant', quantity: 1, unitPrice: 900 }],
      insuranceClaim: {
        payer: { name: 'Mutuelle Hexa', type: 'mutuelle' },
        coveragePercent: 60,
        coveredAmount: 540,
        claimNumber: 'HX-2025',
      },
      issueNow: true,
    });
    expect(invoice?.insuranceClaim).toBeTruthy();
    expect(invoice?.insuranceClaim?.coveragePercent).toBe(60);
  });

  it('prevents adding items once invoice is paid', async () => {
    const { service } = buildService();
    const invoice = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Bridge', quantity: 1, unitPrice: 400 }],
      issueNow: true,
    });
    await service.addPayment(invoice!.id, { amount: invoice!.totals.total, method: 'card', source: 'patient' });
    await expect(
      service.addItems(invoice!.id, { items: [{ description: 'Retouche', quantity: 1, unitPrice: 50 }] })
    ).rejects.toThrow('invoice_paid');
  });

  it('rejects payment when invoice is still draft', async () => {
    const { service } = buildService();
    const invoice = await service.create({
      patientId,
      dueDate: new Date().toISOString(),
    });
    await expect(
      service.addPayment(invoice!.id, { amount: 10, method: 'card', source: 'patient' })
    ).rejects.toThrow('invoice_not_issued');
  });

  it('filters invoices by text query', async () => {
    const { service } = buildService();
    await service.create({
      patientId,
      dueDate: new Date().toISOString(),
      items: [{ description: 'Controle', quantity: 1, unitPrice: 50 }],
      issueNow: true,
    });
    const list = await service.list({ q: 'Facturation' });
    expect(list.data.length).toBeGreaterThan(0);
  });
});
