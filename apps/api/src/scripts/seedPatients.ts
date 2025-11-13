import 'dotenv/config';
import { db, dbPool } from '../db/client';
import { consentForms, patientContacts, patients } from '../db/schema';
import { createPatientService, type CreatePatientPayload } from '../services/patientService';

const samples: CreatePatientPayload[] = [
  {
    fullName: 'Camille Moreau',
    preferredName: 'Camille',
    email: 'camille.moreau@example.com',
    phone: '+33 6 55 22 31 90',
    activeTreatment: 'Invisalign - étape 4/10',
    nextVisit: '2025-03-03T09:30:00.000Z',
    balance: 120,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 6 55 22 31 90', isPrimary: true },
    { type: 'email', label: 'Email', value: 'camille.moreau@example.com', isPrimary: false },
  ],
  consentForms: [
    { template: 'Consentement soins dentaires', version: 'v1', status: 'signed', signedAt: '2024-12-01T10:00:00.000Z' },
    { template: 'Traitement Invisalign', version: 'v1', status: 'pending' },
  ],
},
  {
    fullName: 'Julien Martin',
    email: 'julien.martin@example.com',
    phone: '+33 7 11 78 64 03',
    activeTreatment: 'Implant molaire',
    nextVisit: '2025-03-10T14:00:00.000Z',
    balance: 0,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 7 11 78 64 03', isPrimary: true },
    { type: 'email', label: 'Email', value: 'julien.martin@example.com', isPrimary: false },
  ],
  consentForms: [
    { template: 'Consentement implant', version: 'v1', status: 'signed', signedAt: '2024-10-20T09:00:00.000Z' },
  ],
},
{
    fullName: 'Lina Benali',
    phone: '+33 6 90 33 11 54',
    email: 'lina.benali@example.com',
    activeTreatment: 'Blanchiment + détartrage',
    nextVisit: '2025-02-28T11:00:00.000Z',
    balance: 60,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 6 90 33 11 54', isPrimary: true },
    { type: 'email', label: 'Email', value: 'lina.benali@example.com', isPrimary: false },
    { type: 'emergency', label: 'Mère', value: '+33 6 77 88 99 00', isPrimary: false },
  ],
  consentForms: [{ template: 'Consentement blanchiment', version: 'v1', status: 'pending' }],
},
{
    fullName: 'Marius Lefèvre',
    phone: '+33 6 41 22 55 69',
    email: 'marius.lefevre@example.com',
    activeTreatment: 'Greffe gingivale',
    nextVisit: '2025-03-18T15:15:00.000Z',
    balance: 250,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 6 41 22 55 69', isPrimary: true },
    { type: 'email', label: 'Email', value: 'marius.lefevre@example.com', isPrimary: false },
  ],
  consentForms: [
    { template: 'Consentement chirurgie', version: 'v1', status: 'pending' },
    { template: 'Consentement anesthésie', version: 'v1', status: 'pending' },
  ],
},
{
    fullName: 'Sofia Ribeiro',
    phone: '+33 7 66 44 55 12',
    email: 'sofia.ribeiro@example.com',
    activeTreatment: 'Traitement parodontal',
    nextVisit: '2025-03-05T08:45:00.000Z',
    balance: 30,
  contacts: [
    { type: 'phone', label: 'Mobile', value: '+33 7 66 44 55 12', isPrimary: true },
    { type: 'email', label: 'Email', value: 'sofia.ribeiro@example.com', isPrimary: false },
    { type: 'emergency', label: 'Conjoint', value: '+33 6 22 44 11 99', isPrimary: false },
  ],
  consentForms: [{ template: 'Consentement parodontal', version: 'v1', status: 'signed', signedAt: '2024-11-12T13:00:00.000Z' }],
},
];

(async () => {
  const service = createPatientService(db);
  await db.delete(consentForms);
  await db.delete(patientContacts);
  await db.delete(patients);

  for (const sample of samples) {
    await service.create(sample);
  }

  console.log(`Seeded ${samples.length} patients`);
})()
  .catch((error) => {
    console.error('Seeding failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
