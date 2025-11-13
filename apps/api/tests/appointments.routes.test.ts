import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server';
import { createTestDb } from './utils/testDb';
import { createPatientService } from '../src/services/patientService';
import { createAppointmentService } from '../src/services/appointmentService';
import { AppointmentRealtime } from '../src/services/appointmentRealtime';
import { providers, rooms } from '../src/db/schema';

const authHeaders = (role: 'assistant' | 'practitioner' | 'admin') => ({
  'x-user-role': role,
  'x-user-id': `${role}-user`,
});

describe('appointments routes', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let server: ReturnType<typeof createServer>;
  let providerId: string;
  let roomId: string;
  let patientId: string;

  beforeEach(async () => {
    ctx = await createTestDb();
    const realtime = new AppointmentRealtime();
    const patientService = createPatientService(ctx.database);
    const appointmentService = createAppointmentService(ctx.database, realtime);
    server = createServer({ patientService, appointmentService, realtime });

    const patient = await patientService.create({
      fullName: 'Agenda Route',
      phone: '+33 6 90 80 70 60',
      balance: 0,
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 90 80 70 60', isPrimary: true }],
    });
    patientId = patient.id;

    providerId = randomUUID();
    roomId = randomUUID();

    await ctx.database.insert(providers).values({
      id: providerId,
      fullName: 'Dr Route',
      initials: 'DR',
      specialty: 'Chirurgie',
      role: 'dentist',
      color: '#10b981',
      isActive: true,
      defaultDurationMinutes: 30,
    });

    await ctx.database.insert(rooms).values({
      id: roomId,
      name: 'Salle Route',
      color: '#0ea5e9',
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(server).get('/api/appointments');
    expect(res.status).toBe(401);
  });

  it('creates and lists appointments', async () => {
    const start = DateTime.fromISO('2025-03-10T09:00:00', { zone: 'Europe/Paris' }).toISO();
    const createRes = await request(server)
      .post('/api/appointments')
      .set(authHeaders('assistant'))
      .send({ providerId, roomId, patientId, title: 'Route Create', startAt: start, durationMinutes: 30 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.provider.id).toBe(providerId);

    const listRes = await request(server).get('/api/appointments').set(authHeaders('assistant'));
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
  });

  it('cancels appointments with practitioner role only', async () => {
    const start = DateTime.fromISO('2025-03-11T14:00:00', { zone: 'Europe/Paris' }).toISO();
    const createRes = await request(server)
      .post('/api/appointments')
      .set(authHeaders('assistant'))
      .send({ providerId, roomId, patientId, title: 'Annulation', startAt: start, durationMinutes: 30 });

    const id = createRes.body.data.id;

    const forbidden = await request(server)
      .patch(`/api/appointments/${id}/cancel`)
      .set(authHeaders('assistant'))
      .send({ reason: 'Test' });
    expect(forbidden.status).toBe(403);

    const cancelRes = await request(server)
      .patch(`/api/appointments/${id}/cancel`)
      .set(authHeaders('practitioner'))
      .send({ reason: 'Patient en retard' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
  });

  it('streams updates via long polling channel', async () => {
    const start = DateTime.fromISO('2025-03-12T10:00:00', { zone: 'Europe/Paris' }).toISO();
    await request(server)
      .post('/api/appointments')
      .set(authHeaders('assistant'))
      .send({ providerId, roomId, patientId, title: 'Event', startAt: start, durationMinutes: 30 });

    const updates = await request(server)
      .get('/api/appointments/updates?cursor=0')
      .set(authHeaders('assistant'));

    expect(updates.status).toBe(200);
    expect(updates.body.events[0].type).toBe('appointment.created');
  });
});
