import { beforeEach, describe, expect, it } from 'vitest';
import { patientService } from '../src/services/patientService';

const samplePayload = {
  fullName: 'Test Patient',
  phone: '+33 6 11 22 33 44',
  activeTreatment: 'Consultation',
  nextVisit: new Date('2025-03-01T09:00:00Z').toISOString(),
  balance: 0,
};

describe('patientService', () => {
  beforeEach(() => {
    patientService.reset();
  });

  it('returns seeded patients', () => {
    const patients = patientService.list();
    expect(patients.length).toBeGreaterThan(0);
  });

  it('prepends newly created patients', () => {
    const created = patientService.create(samplePayload);
    const [first] = patientService.list();

    expect(created.id).toMatch(/^pat-/);
    expect(first.id).toBe(created.id);
    expect(first.fullName).toBe(samplePayload.fullName);
  });
});
