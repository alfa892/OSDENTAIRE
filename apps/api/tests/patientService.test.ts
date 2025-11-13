import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPatientService, type CreatePatientPayload } from '../src/services/patientService';
import { createTestDb } from './utils/testDb';
import { patients } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const payload: CreatePatientPayload = {
  fullName: 'Test Patient',
  preferredName: 'Testy',
  email: 'test.patient@example.com',
  phone: '+33 6 11 22 33 44',
  activeTreatment: 'Consultation',
  nextVisit: '2025-03-01T09:00:00Z',
  balance: 42,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 6 11 22 33 44', isPrimary: true },
    { type: 'email', label: 'Email', value: 'test.patient@example.com', isPrimary: false },
  ],
  consentForms: [{ template: 'Consentement test', version: 'v1', status: 'pending' }],
};

describe('patientService', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let service: ReturnType<typeof createPatientService>;

  beforeEach(async () => {
    ctx = await createTestDb();
    service = createPatientService(ctx.database);
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('creates patients and lists them', async () => {
    await service.create(payload);
    const list = await service.list();

    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      fullName: 'Test Patient',
      primaryContact: { value: '+33 6 11 22 33 44' },
      pendingConsents: 1,
    });
  });

  it('filters by search term', async () => {
    await service.create(payload);
    const results = await service.list({ q: 'Test' });
    expect(results.total).toBe(1);

    const empty = await service.list({ q: 'Nope' });
    expect(empty.total).toBe(0);
  });

  it('soft deletes and anonymizes entries', async () => {
    const created = await service.create(payload);
    await service.softDelete(created.id);

    const archived = await service.list({ status: 'archived' });
    expect(archived.total).toBe(1);

    await ctx.database
      .update(patients)
      .set({ deletedAt: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000) })
      .where(eq(patients.id, created.id));

    const anonymized = await service.anonymize(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    expect(anonymized).toBe(1);
  });
});
