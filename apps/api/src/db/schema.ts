import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const patientStatus = pgEnum('patient_status', ['active', 'archived']);
export const contactType = pgEnum('contact_type', ['phone', 'email', 'emergency']);
export const consentStatus = pgEnum('consent_status', ['pending', 'signed']);
export const providerRole = pgEnum('provider_role', ['dentist', 'orthodontist', 'hygienist']);
export const appointmentStatus = pgEnum('appointment_status', ['scheduled', 'cancelled']);
export const appointmentNoteType = pgEnum('appointment_note_type', ['note', 'notification']);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    fullName: text('full_name').notNull(),
    preferredName: text('preferred_name'),
    email: text('email'),
    phone: text('phone'),
    activeTreatment: text('active_treatment'),
    status: patientStatus('status').notNull().default('active'),
    nextVisit: timestamp('next_visit', { withTimezone: true }),
    balanceCents: integer('balance_cents').notNull().default(0),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    referenceIdx: uniqueIndex('patients_reference_idx').on(table.reference),
    statusIdx: index('patients_status_idx').on(table.status),
    deletedAtIdx: index('patients_deleted_at_idx').on(table.deletedAt),
  })
);

export const patientContacts = pgTable(
  'patient_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    type: contactType('type').notNull(),
    label: text('label').notNull(),
    value: text('value').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    patientIdx: index('patient_contacts_patient_idx').on(table.patientId),
  })
);

export const consentForms = pgTable(
  'consent_forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    template: text('template').notNull(),
    version: text('version').notNull().default('v1'),
    status: consentStatus('status').notNull().default('pending'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    fileUrl: text('file_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    patientIdx: index('consent_forms_patient_idx').on(table.patientId),
  })
);

export const patientRelations = relations(patients, ({ many }) => ({
  contacts: many(patientContacts),
  consents: many(consentForms),
}));

export const patientContactRelations = relations(patientContacts, ({ one }) => ({
  patient: one(patients, {
    fields: [patientContacts.patientId],
    references: [patients.id],
  }),
}));

export const consentFormRelations = relations(consentForms, ({ one }) => ({
  patient: one(patients, {
    fields: [consentForms.patientId],
    references: [patients.id],
  }),
}));

export const providers = pgTable(
  'providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    initials: text('initials').notNull(),
    specialty: text('specialty'),
    role: providerRole('role').notNull().default('dentist'),
    color: text('color').notNull().default('#0ea5e9'),
    isActive: boolean('is_active').notNull().default(true),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(30),
    nextAvailableAt: timestamp('next_available_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerNameIdx: uniqueIndex('providers_full_name_idx').on(table.fullName),
  })
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6366f1'),
    floor: text('floor'),
    equipment: text('equipment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roomNameIdx: uniqueIndex('rooms_name_idx').on(table.name),
  })
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'restrict' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    status: appointmentStatus('status').notNull().default('scheduled'),
    timezone: text('timezone').notNull().default('Europe/Paris'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    slotMinutes: integer('slot_minutes').notNull(),
    createdBy: text('created_by').notNull(),
    createdByRole: text('created_by_role').notNull(),
    cancelReason: text('cancel_reason'),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appointmentProviderIdx: index('appointments_provider_idx').on(table.providerId, table.startAt),
    appointmentRoomIdx: index('appointments_room_idx').on(table.roomId, table.startAt),
    appointmentStatusIdx: index('appointments_status_idx').on(table.status),
    appointmentStartIdx: index('appointments_start_idx').on(table.startAt),
  })
);

export const appointmentNotes = pgTable(
  'appointment_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    authorRole: text('author_role').notNull(),
    authorName: text('author_name').notNull(),
    kind: appointmentNoteType('kind').notNull().default('note'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appointmentNoteIdx: index('appointment_notes_appointment_idx').on(table.appointmentId),
  })
);

export const providerRelations = relations(providers, ({ many }) => ({
  appointments: many(appointments),
}));

export const roomRelations = relations(rooms, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentRelations = relations(appointments, ({ one, many }) => ({
  provider: one(providers, {
    fields: [appointments.providerId],
    references: [providers.id],
  }),
  room: one(rooms, {
    fields: [appointments.roomId],
    references: [rooms.id],
  }),
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  notes: many(appointmentNotes),
}));

export const appointmentNoteRelations = relations(appointmentNotes, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentNotes.appointmentId],
    references: [appointments.id],
  }),
}));
