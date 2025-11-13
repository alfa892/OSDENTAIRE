import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server';
import { createTestDb } from './utils/testDb';
import { createPatientService, type CreatePatientPayload } from '../src/services/patientService';

const authHeaders = (role: 'assistant' | 'practitioner' | 'admin') => ({
  'x-user-role': role,
  'x-user-id': `${role}-user`,
});

const sampleBody: CreatePatientPayload = {
  fullName: 'Route Test',
  phone: '+33 6 99 99 99 99',
  activeTreatment: 'Détartrage',
  nextVisit: '2025-04-01T09:00:00.000Z',
  balance: 0,
  contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 99 99 99 99', isPrimary: true }],
  consentForms: [{ template: 'Consentement test', version: 'v1', status: 'pending' }],
};

describe('patients routes', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let server: ReturnType<typeof createServer>;
  let service: ReturnType<typeof createPatientService>;

  beforeEach(async () => {
    ctx = await createTestDb();
    service = createPatientService(ctx.database);
    server = createServer({ patientService: service });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(server).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('lists patients with assistant role', async () => {
    await service.create({ ...sampleBody, contacts: sampleBody.contacts });
    const res = await request(server).get('/api/patients').set(authHeaders('assistant'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 422 when pagination params are invalid', async () => {
    const res = await request(server).get('/api/patients?limit=5000').set(authHeaders('assistant'));
    expect(res.status).toBe(422);
  });

  it('prevents practitioners from creating patients', async () => {
    const res = await request(server)
      .post('/api/patients')
      .set(authHeaders('practitioner'))
      .send(sampleBody);
    expect(res.status).toBe(403);
  });

  it('allows assistants to create patients', async () => {
    const res = await request(server)
      .post('/api/patients')
      .set(authHeaders('assistant'))
      .send(sampleBody);
    expect(res.status).toBe(201);
    expect(res.body.data.fullName).toBe('Route Test');
  });

  it('rejects invalid payloads with 422', async () => {
    const res = await request(server)
      .post('/api/patients')
      .set(authHeaders('assistant'))
      .send({ fullName: 'A' });
    expect(res.status).toBe(422);
  });

  it('requires admin role for deletion', async () => {
    const created = await service.create(sampleBody);

    const assistantDelete = await request(server)
      .delete(`/api/patients/${created.id}`)
      .set(authHeaders('assistant'));
    expect(assistantDelete.status).toBe(403);

    const adminDelete = await request(server)
      .delete(`/api/patients/${created.id}`)
      .set(authHeaders('admin'));
    expect(adminDelete.status).toBe(204);
  });

  it('validates patient id formats', async () => {
    const res = await request(server).get('/api/patients/not-a-uuid').set(authHeaders('assistant'));
    expect(res.status).toBe(422);
  });

  it('returns 404 when patient is missing', async () => {
    const res = await request(server).get(`/api/patients/${randomUUID()}`).set(authHeaders('assistant'));
    expect(res.status).toBe(404);
  });

  it('returns 404 on deletion of unknown patient', async () => {
    const res = await request(server)
      .delete(`/api/patients/${randomUUID()}`)
      .set(authHeaders('admin'));
    expect(res.status).toBe(404);
  });
});
