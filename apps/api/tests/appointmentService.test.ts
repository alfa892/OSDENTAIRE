import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { createAppointmentService, AppointmentError } from '../src/services/appointmentService';
import { createPatientService } from '../src/services/patientService';
import { createTestDb } from './utils/testDb';
import { providers, rooms } from '../src/db/schema';
import { AppointmentRealtime } from '../src/services/appointmentRealtime';

const user = { id: 'tester', role: 'assistant' as const };

const createProviderAndRoom = async (database: Awaited<ReturnType<typeof createTestDb>>['database']) => {
  const providerId = randomUUID();
  const roomId = randomUUID();

  await database.insert(providers).values({
    id: providerId,
    fullName: 'Dr Test',
    initials: 'DT',
    specialty: 'Omnipraticien',
    role: 'dentist',
    color: '#0ea5e9',
    isActive: true,
    defaultDurationMinutes: 30,
  });

  await database.insert(rooms).values({
    id: roomId,
    name: 'Salle test',
    color: '#38bdf8',
  });

  return { providerId, roomId };
};

describe('appointmentService', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let service: ReturnType<typeof createAppointmentService>;
  let patientId: string;
  let providerId: string;
  let roomId: string;

  beforeEach(async () => {
    ctx = await createTestDb();
    const realtime = new AppointmentRealtime();
    service = createAppointmentService(ctx.database, realtime);
    const patientService = createPatientService(ctx.database);
    const patient = await patientService.create({
      fullName: 'Agenda Patient',
      phone: '+33 6 44 55 66 77',
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 44 55 66 77', isPrimary: true }],
      balance: 0,
    });
    patientId = patient.id;
    const refs = await createProviderAndRoom(ctx.database);
    providerId = refs.providerId;
    roomId = refs.roomId;
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('creates and lists appointments', async () => {
    const start = DateTime.fromISO('2025-03-03T09:00:00', { zone: 'Europe/Paris' }).toISO();
    const created = await service.create(
      {
        providerId,
        roomId,
        patientId,
        title: 'Consultation',
        startAt: start,
        durationMinutes: 30,
      },
      user
    );

    expect(created.title).toBe('Consultation');
    expect(created.provider.id).toBe(providerId);

    const list = await service.list({ start, end: DateTime.fromISO(start).plus({ days: 7 }).toISO() });
    expect(list.data).toHaveLength(1);
    expect(list.providers).toHaveLength(1);
  });

  it('prevents double booking for provider and room', async () => {
    const base = DateTime.fromISO('2025-03-04T10:00:00', { zone: 'Europe/Paris' }).toISO();
    await service.create(
      { providerId, roomId, patientId, title: 'Bloc', startAt: base, durationMinutes: 30 },
      user
    );

    await expect(
      service.create(
        { providerId, roomId, patientId, title: 'Chevauchement', startAt: base, durationMinutes: 30 },
        user
      )
    ).rejects.toBeInstanceOf(AppointmentError);
  });

  it('validates slot alignment', async () => {
    const start = DateTime.fromISO('2025-03-05T09:10:00', { zone: 'Europe/Paris' }).toISO();
    await expect(
      service.create(
        { providerId, roomId, patientId, title: 'Mauvais slot', startAt: start, durationMinutes: 30 },
        user
      )
    ).rejects.toThrow('invalid_slot_alignment');
  });

  it('cancels an appointment and records notification', async () => {
    const start = DateTime.fromISO('2025-03-06T09:00:00', { zone: 'Europe/Paris' }).toISO();
    const created = await service.create(
      { providerId, roomId, patientId, title: 'Extraction', startAt: start, durationMinutes: 30 },
      { id: 'practitioner', role: 'practitioner' }
    );

    const cancelled = await service.cancel(created.id, { reason: 'Patient malade' }, { id: 'practitioner', role: 'practitioner' });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelReason).toContain('Patient');
  });
});
