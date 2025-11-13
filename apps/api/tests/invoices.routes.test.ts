import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server';
import { createTestDb } from './utils/testDb';
import { createPatientService } from '../src/services/patientService';
import { createInvoiceService } from '../src/services/invoiceService';
import { createInMemoryInvoiceStorage } from '../src/services/invoiceStorage';
import { createMemoryMailer } from '../src/services/invoiceMailer';

const authHeaders = (role: 'practitioner' | 'admin') => ({
  'x-user-role': role,
  'x-user-id': `${role}-user`,
});

describe('invoice routes', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let patientId: string;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    ctx = await createTestDb();
    const patientService = createPatientService(ctx.database);
    const patient = await patientService.create({
      fullName: 'Route Patient',
      phone: '+33 6 55 11 22 33',
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 55 11 22 33', isPrimary: true }],
    });
    patientId = patient.id;

    const invoiceService = createInvoiceService(ctx.database, {
      storage: createInMemoryInvoiceStorage(),
      mailer: createMemoryMailer(),
      pdfGenerator: async () => Buffer.from('pdf'),
    });

    server = createServer({ patientService, invoiceService });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(server).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('creates and lists invoices', async () => {
    const createRes = await request(server)
      .post('/api/invoices')
      .set(authHeaders('practitioner'))
      .send({
        patientId,
        dueDate: new Date().toISOString(),
        items: [{ description: 'Controle', quantity: 1, unitPrice: 50 }],
        issueNow: true,
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.data.id;

    const listRes = await request(server).get('/api/invoices').set(authHeaders('practitioner'));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const detail = await request(server).get(`/api/invoices/${invoiceId}`).set(authHeaders('admin'));
    expect(detail.status).toBe(200);
    expect(detail.body.data.reference).toMatch(/INV-/);
  });

  it('validates payloads', async () => {
    const res = await request(server)
      .post('/api/invoices')
      .set(authHeaders('admin'))
      .send({ patientId });
    expect(res.status).toBe(422);
  });

  it('adds items and records payments with RBAC', async () => {
    const createRes = await request(server)
      .post('/api/invoices')
      .set(authHeaders('admin'))
      .send({
        patientId,
        dueDate: new Date().toISOString(),
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.data.id;

    const itemRes = await request(server)
      .post(`/api/invoices/${invoiceId}/items`)
      .set(authHeaders('admin'))
      .send({
        items: [{ description: 'Bridge', quantity: 1, unitPrice: 900 }],
        issueNow: true,
      });
    expect(itemRes.status).toBe(201);
    expect(itemRes.body.data.status).toBe('issued');

    const payRes = await request(server)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeaders('admin'))
      .send({ amount: itemRes.body.data.totals.total, method: 'transfer', source: 'patient' });
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.status).toBe('paid');
  });

  it('returns 422 on malformed invoice id', async () => {
    const res = await request(server).get('/api/invoices/not-a-uuid').set(authHeaders('admin'));
    expect(res.status).toBe(422);
  });

  it('guards nested routes without auth', async () => {
    const created = await request(server)
      .post('/api/invoices')
      .set(authHeaders('admin'))
      .send({ patientId, dueDate: new Date().toISOString() });
    const invoiceId = created.body.data.id;
    const res = await request(server)
      .post(`/api/invoices/${invoiceId}/items`)
      .send({ items: [{ description: 'Bloc', unitPrice: 10 }] });
    expect(res.status).toBe(401);
  });

  it('prevents payment when invoice is draft', async () => {
    const created = await request(server)
      .post('/api/invoices')
      .set(authHeaders('admin'))
      .send({
        patientId,
        dueDate: new Date().toISOString(),
      });
    const invoiceId = created.body.data.id;
    const payRes = await request(server)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(authHeaders('admin'))
      .send({ amount: 10, method: 'card', source: 'patient' });
    expect(payRes.status).toBe(409);
  });
});
