import { describe, expect, it } from 'vitest';
import {
  listAppointmentsQuerySchema,
  createAppointmentSchema,
  cancelAppointmentSchema,
} from '../src/validation/appointments';

const sampleId = '11111111-1111-4111-8111-111111111111';
const sampleRoom = '22222222-2222-4222-8222-222222222222';
const samplePatient = '33333333-3333-4333-8333-333333333333';

describe('appointments validation schemas', () => {
  it('parses filters with comma-separated ids', () => {
    const parsed = listAppointmentsQuerySchema.parse({
      providerId: `${sampleId},${sampleId}`,
      includeNotes: 'true',
    });
    expect(parsed.providerId).toHaveLength(2);
    expect(parsed.includeNotes).toBe(true);
  });

  it('validates create payloads and rejects invalid durations', () => {
    const payload = {
      providerId: sampleId,
      roomId: sampleRoom,
      patientId: samplePatient,
      title: 'Test',
      startAt: '2025-03-03T09:00:00+01:00',
      durationMinutes: 30,
    };
    expect(() => createAppointmentSchema.parse(payload)).not.toThrow();
    expect(() =>
      createAppointmentSchema.parse({ ...payload, durationMinutes: 3 })
    ).toThrowError();
  });

  it('accepts optional cancel reason', () => {
    const parsed = cancelAppointmentSchema.parse({ reason: 'Patient malade' });
    expect(parsed.reason).toBe('Patient malade');
  });
});
