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
export const invoiceStatus = pgEnum('invoice_status', ['draft', 'issued', 'paid']);
export const payerType = pgEnum('payer_type', ['patient', 'mutuelle', 'insurance', 'third_party']);
export const paymentSource = pgEnum('payment_source', ['patient', 'mutuelle', 'insurance', 'other']);
export const insuranceClaimStatus = pgEnum('insurance_claim_status', ['draft', 'submitted', 'approved', 'rejected']);
export type AppointmentNoteType = (typeof appointmentNoteType.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type PaymentSource = (typeof paymentSource.enumValues)[number];

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

export const payers = pgTable(
  'payers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    type: payerType('type').notNull().default('patient'),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('address_line1'),
    postalCode: text('postal_code'),
    city: text('city'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    payerTypeIdx: index('payers_type_idx').on(table.type),
  })
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => payers.id, { onDelete: 'restrict' }),
    status: invoiceStatus('status').notNull().default('draft'),
    currency: text('currency').notNull().default('EUR'),
    totalExclTaxCents: integer('total_excl_tax_cents').notNull().default(0),
    totalTaxCents: integer('total_tax_cents').notNull().default(0),
    totalInclTaxCents: integer('total_incl_tax_cents').notNull().default(0),
    paidAmountCents: integer('paid_amount_cents').notNull().default(0),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    notes: text('notes'),
    pdfStorageKey: text('pdf_storage_key'),
    pdfSignedUrl: text('pdf_signed_url'),
    pdfSignedUrlExpiresAt: timestamp('pdf_signed_url_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceReferenceIdx: uniqueIndex('invoices_reference_idx').on(table.reference),
    invoiceStatusIdx: index('invoices_status_idx').on(table.status),
    invoicePatientIdx: index('invoices_patient_idx').on(table.patientId),
  })
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull().default(2000),
    totalExclTaxCents: integer('total_excl_tax_cents').notNull().default(0),
    totalTaxCents: integer('total_tax_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceItemInvoiceIdx: index('invoice_items_invoice_idx').on(table.invoiceId),
  })
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => payers.id, { onDelete: 'restrict' }),
    source: paymentSource('source').notNull().default('patient'),
    method: text('method').notNull().default('card'),
    amountCents: integer('amount_cents').notNull(),
    notes: text('notes'),
    reference: text('reference'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    paymentInvoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
  })
);

export const insuranceClaims = pgTable(
  'insurance_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => payers.id, { onDelete: 'restrict' }),
    status: insuranceClaimStatus('status').notNull().default('draft'),
    claimNumber: text('claim_number'),
    coveragePercent: integer('coverage_percent').notNull().default(0),
    coveredAmountCents: integer('covered_amount_cents').notNull().default(0),
    filedAt: timestamp('filed_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    insuranceClaimInvoiceIdx: index('insurance_claims_invoice_idx').on(table.invoiceId),
  })
);

export const payerRelations = relations(payers, ({ many, one }) => ({
  invoices: many(invoices),
  payments: many(payments),
  claims: many(insuranceClaims),
  patient: one(patients, {
    fields: [payers.patientId],
    references: [patients.id],
  }),
}));

export const invoiceRelations = relations(invoices, ({ many, one }) => ({
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  payer: one(payers, {
    fields: [invoices.payerId],
    references: [payers.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
  claims: many(insuranceClaims),
}));

export const invoiceItemRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  payer: one(payers, {
    fields: [payments.payerId],
    references: [payers.id],
  }),
}));

export const insuranceClaimRelations = relations(insuranceClaims, ({ one }) => ({
  invoice: one(invoices, {
    fields: [insuranceClaims.invoiceId],
    references: [invoices.id],
  }),
  payer: one(payers, {
    fields: [insuranceClaims.payerId],
    references: [payers.id],
  }),
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
