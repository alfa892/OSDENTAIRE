import 'dotenv/config';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { db, dbPool } from '../db/client';
import { appointmentNotes, appointments, patients, providers, rooms } from '../db/schema';
import { createAppointmentService } from '../services/appointmentService';
import { createPatientService, type CreatePatientPayload } from '../services/patientService';

const ensurePatients = async () => {
  const patientRows = await db.select({ id: patients.id }).from(patients).limit(5);
  if (patientRows.length >= 3) {
    return patientRows.map((row) => row.id);
  }

  const patientService = createPatientService(db);
  const samples: CreatePatientPayload[] = [
    {
      fullName: 'Patient Agenda 1',
      phone: '+33 6 01 01 01 01',
      balance: 0,
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 01 01 01 01', isPrimary: true }],
    },
    {
      fullName: 'Patient Agenda 2',
      phone: '+33 6 02 02 02 02',
      balance: 0,
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 02 02 02 02', isPrimary: true }],
    },
    {
      fullName: 'Patient Agenda 3',
      phone: '+33 6 03 03 03 03',
      balance: 0,
      contacts: [{ type: 'phone', label: 'Mobile', value: '+33 6 03 03 03 03', isPrimary: true }],
    },
  ];

  const created: string[] = [];
  for (const sample of samples) {
    const patient = await patientService.create(sample);
    created.push(patient.id);
  }

  return created;
};

(async () => {
  await db.delete(appointmentNotes);
  await db.delete(appointments);
  await db.delete(providers);
  await db.delete(rooms);

  const providerEntities = [
    {
      id: randomUUID(),
      fullName: 'Dr Jade Nguyen',
      initials: 'JN',
      specialty: 'Omnipraticienne',
      role: 'dentist' as const,
      color: '#22d3ee',
      defaultDurationMinutes: 45,
    },
    {
      id: randomUUID(),
      fullName: 'Dr Marc Dupont',
      initials: 'MD',
      specialty: 'Chirurgien dentaire',
      role: 'orthodontist' as const,
      color: '#f97316',
      defaultDurationMinutes: 30,
    },
  ];

  const roomEntities = [
    { id: randomUUID(), name: 'Salle 1', color: '#38bdf8', floor: '1er', equipment: 'Fauteuil Planmeca' },
    { id: randomUUID(), name: 'Salle 2', color: '#a855f7', floor: '1er', equipment: 'Microscope' },
  ];

  await db.insert(providers).values(
    providerEntities.map((provider) => ({
      ...provider,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      initials: provider.initials,
    }))
  );

  await db.insert(rooms).values(
    roomEntities.map((room) => ({
      ...room,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );

  const appointmentSvc = createAppointmentService(db);
  const patientPool = await ensurePatients();
  const startOfWeek = DateTime.now().setZone('Europe/Paris').startOf('week');
  const systemUser: Express.UserContext = { id: 'seed-script', role: 'admin' };

  const slots = [
    { dayOffset: 0, hour: 9, provider: providerEntities[0], room: roomEntities[0], duration: 45, title: 'Contrôle + Détartrage' },
    { dayOffset: 0, hour: 14, provider: providerEntities[1], room: roomEntities[1], duration: 30, title: 'Consultation Invisalign' },
    { dayOffset: 1, hour: 10, provider: providerEntities[0], room: roomEntities[0], duration: 60, title: 'Chirurgie parodontal' },
    { dayOffset: 2, hour: 16, provider: providerEntities[1], room: roomEntities[1], duration: 30, title: 'Suivi implant' },
    { dayOffset: 3, hour: 11, provider: providerEntities[0], room: roomEntities[0], duration: 45, title: 'Plan de traitement' },
    { dayOffset: 4, hour: 15, provider: providerEntities[1], room: roomEntities[1], duration: 30, title: 'Controle post-op' },
  ];

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const patientId = patientPool[index % patientPool.length];
    const start = startOfWeek.plus({ days: slot.dayOffset }).set({ hour: slot.hour, minute: 0 });

    await appointmentSvc.create(
      {
        providerId: slot.provider.id,
        roomId: slot.room.id,
        patientId,
        title: slot.title,
        startAt: start.toISO(),
        durationMinutes: slot.duration,
      },
      systemUser
    );
  }

  console.log('Seeded providers, rooms and weekly appointments');
})()
  .catch((error) => {
    console.error('Agenda seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
