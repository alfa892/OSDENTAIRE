export type Patient = {
  id: string;
  fullName: string;
  phone: string;
  activeTreatment: string;
  nextVisit: string;
  balance: number;
};

export const mockPatients: Patient[] = [
  {
    id: 'pat-001',
    fullName: 'Camille Moreau',
    phone: '+33 6 55 22 31 90',
    activeTreatment: 'Invisalign - étape 4/10',
    nextVisit: '2025-03-03T09:30:00.000Z',
    balance: 120,
  },
  {
    id: 'pat-002',
    fullName: 'Julien Martin',
    phone: '+33 7 11 78 64 03',
    activeTreatment: 'Implant molaire',
    nextVisit: '2025-03-10T14:00:00.000Z',
    balance: 0,
  },
  {
    id: 'pat-003',
    fullName: 'Lina Benali',
    phone: '+33 6 90 33 11 54',
    activeTreatment: 'Blanchiment + détartrage',
    nextVisit: '2025-02-28T11:00:00.000Z',
    balance: 60,
  },
];
