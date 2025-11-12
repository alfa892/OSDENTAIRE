import { mockPatients, type Patient } from '../data/mockPatients';

export type CreatePatientPayload = Omit<Patient, 'id'>;

let patients: Patient[] = [...mockPatients];

const buildPatientId = (index: number) => `pat-${String(index).padStart(3, '0')}`;

export const patientService = {
  list(): Patient[] {
    return patients;
  },
  create(payload: CreatePatientPayload): Patient {
    const newPatient: Patient = {
      id: buildPatientId(patients.length + 1),
      ...payload,
      nextVisit: new Date(payload.nextVisit).toISOString(),
    };

    patients = [newPatient, ...patients];
    return newPatient;
  },
  reset(): void {
    patients = [...mockPatients];
  },
};
