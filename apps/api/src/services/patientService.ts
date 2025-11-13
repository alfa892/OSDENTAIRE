import { and, desc, eq, ilike, inArray, isNull, lte, not, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import { db, dbSchema } from '../db/client';
import { consentForms, patientContacts, patients } from '../db/schema';
import { contactInputSchema, createPatientSchema, listPatientsQuerySchema } from '../validation/patients';
import type { z } from 'zod';

export type ListPatientsInput = Partial<{
  q: string;
  status: 'active' | 'archived';
  limit: number;
  offset: number;
}>;

export type PatientListItem = {
  id: string;
  reference: string;
  fullName: string;
  status: 'active' | 'archived';
  activeTreatment: string | null;
  nextVisit: string | null;
  balance: number;
  primaryContact: { label: string; value: string } | null;
  pendingConsents: number;
};

export type PatientDetail = {
  id: string;
  reference: string;
  fullName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  activeTreatment: string | null;
  status: 'active' | 'archived';
  nextVisit: string | null;
  balance: number;
  notes: string | null;
  contacts: Array<{
    id: string;
    type: 'phone' | 'email' | 'emergency';
    label: string;
    value: string;
    isPrimary: boolean;
  }>;
  consentForms: Array<{
    id: string;
    template: string;
    status: 'pending' | 'signed';
    signedAt: string | null;
    fileUrl: string | null;
  }>;
};

export type CreatePatientPayload = z.infer<typeof createPatientSchema>;

export type PatientService = ReturnType<typeof createPatientService>;

const euroFromCents = (value: number) => Number((value / 100).toFixed(2));
const centsFromEuro = (value: number | undefined) => Math.round((value ?? 0) * 100);

const buildReference = () => `PAT-${nanoid(6).toUpperCase()}`;

type PatientDb = NodePgDatabase<typeof dbSchema> | PgliteDatabase<typeof dbSchema>;

export const createPatientService = (database: PatientDb = db) => {
  const list = async (rawInput: ListPatientsInput = {}) => {
    const parsed = listPatientsQuerySchema.parse(rawInput);
    const filters: SQL<unknown>[] = [];

    if (parsed.status === 'active') {
      filters.push(isNull(patients.deletedAt));
    } else {
      filters.push(not(isNull(patients.deletedAt)));
    }

    if (parsed.q) {
      const likeValue = `%${parsed.q}%`;
      const searchCondition = or(
        ilike(patients.fullName, likeValue),
        ilike(patients.reference, likeValue),
        ilike(patients.phone, likeValue)
      ) as SQL<unknown>;
      filters.push(searchCondition);
    }

    let whereClause: SQL<unknown> | undefined;
    if (filters.length === 1) {
      [whereClause] = filters;
    } else if (filters.length > 1) {
      whereClause = and(...filters);
    }

    const baseSelect = database
      .select({
        id: patients.id,
        reference: patients.reference,
        fullName: patients.fullName,
        status: patients.status,
        activeTreatment: patients.activeTreatment,
        nextVisit: patients.nextVisit,
        balanceCents: patients.balanceCents,
      })
      .from(patients);

    const filteredSelect = whereClause ? baseSelect.where(whereClause) : baseSelect;
    const selectQuery = filteredSelect
      .orderBy(desc(patients.createdAt))
      .limit(parsed.limit)
      .offset(parsed.offset);

    const baseCount = database.select({ count: sql<number>`count(*)::int` }).from(patients);
    const countQuery = whereClause ? baseCount.where(whereClause) : baseCount;

    const [rows, countRows] = await Promise.all([selectQuery, countQuery]);

    const total = countRows[0]?.count ?? 0;

    if (rows.length === 0) {
      return { data: [], total, limit: parsed.limit, offset: parsed.offset };
    }

    const ids = rows.map((row) => row.id);

    const [contactRows, consentRows] = await Promise.all([
      database
        .select({
          patientId: patientContacts.patientId,
          label: patientContacts.label,
          value: patientContacts.value,
          isPrimary: patientContacts.isPrimary,
        })
        .from(patientContacts)
        .where(inArray(patientContacts.patientId, ids)),
      database
        .select({
          patientId: consentForms.patientId,
          status: consentForms.status,
        })
        .from(consentForms)
        .where(inArray(consentForms.patientId, ids)),
    ]);

    const contactsByPatient = new Map<string, typeof contactRows>();
    for (const row of contactRows) {
      const current = contactsByPatient.get(row.patientId) ?? [];
      current.push(row);
      contactsByPatient.set(row.patientId, current);
    }

    const pendingByPatient = new Map<string, number>();
    for (const row of consentRows) {
      if (row.status === 'pending') {
        pendingByPatient.set(row.patientId, (pendingByPatient.get(row.patientId) ?? 0) + 1);
      }
    }

    const data: PatientListItem[] = rows.map((row) => {
      const contacts = contactsByPatient.get(row.id) ?? [];
      const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
      return {
        id: row.id,
        reference: row.reference,
        fullName: row.fullName,
        status: row.status,
        activeTreatment: row.activeTreatment,
        nextVisit: row.nextVisit ? row.nextVisit.toISOString() : null,
        balance: euroFromCents(row.balanceCents ?? 0),
        primaryContact: primary ? { label: primary.label, value: primary.value } : null,
        pendingConsents: pendingByPatient.get(row.id) ?? 0,
      };
    });

    return { data, total, limit: parsed.limit, offset: parsed.offset };
  };

  const getById = async (patientId: string): Promise<PatientDetail | null> => {
    const patient = await database.query.patients.findFirst({
      where: (table, { eq }) => eq(table.id, patientId),
      with: {
        contacts: true,
        consents: true,
      },
    });

    if (!patient) return null;

    return {
      id: patient.id,
      reference: patient.reference,
      fullName: patient.fullName,
      preferredName: patient.preferredName ?? null,
      email: patient.email ?? null,
      phone: patient.phone ?? null,
      activeTreatment: patient.activeTreatment ?? null,
      status: patient.status,
      nextVisit: patient.nextVisit ? patient.nextVisit.toISOString() : null,
      balance: euroFromCents(patient.balanceCents ?? 0),
      notes: patient.notes ?? null,
      contacts: patient.contacts.map((contact) => ({
        id: contact.id,
        type: contact.type,
        label: contact.label,
        value: contact.value,
        isPrimary: contact.isPrimary,
      })),
      consentForms: patient.consents.map((consent) => ({
        id: consent.id,
        template: consent.template,
        status: consent.status,
        signedAt: consent.signedAt ? consent.signedAt.toISOString() : null,
        fileUrl: consent.fileUrl ?? null,
      })),
    };
  };

  const create = async (rawInput: CreatePatientPayload) => {
    const parsed = createPatientSchema.parse(rawInput);
    const contacts = parsed.contacts.map((contact, index) =>
      contactInputSchema.parse({ ...contact, isPrimary: contact.isPrimary ?? index === 0 })
    );
    const consentsPayload = parsed.consentForms?.length
      ? parsed.consentForms
      : [
          {
            template: 'Consentement soins dentaires',
            status: 'pending' as const,
            version: 'v1',
          },
        ];

    const result = await database.transaction(async (tx) => {
      const [patient] = await tx
        .insert(patients)
        .values({
          id: randomUUID(),
          reference: buildReference(),
          fullName: parsed.fullName,
          preferredName: parsed.preferredName,
          email: parsed.email,
          phone: parsed.phone,
          activeTreatment: parsed.activeTreatment,
          nextVisit: parsed.nextVisit ? new Date(parsed.nextVisit) : null,
          balanceCents: centsFromEuro(parsed.balance),
          notes: parsed.notes,
        })
        .returning();

      await tx.insert(patientContacts).values(
        contacts.map((contact) => ({
          id: randomUUID(),
          patientId: patient.id,
          type: contact.type,
          label: contact.label,
          value: contact.value,
          isPrimary: contact.isPrimary ?? false,
        }))
      );

      await tx.insert(consentForms).values(
        consentsPayload.map((consent) => ({
          id: randomUUID(),
          patientId: patient.id,
          template: consent.template,
          status: consent.status ?? 'pending',
          version: consent.version ?? 'v1',
          signedAt: consent.signedAt ? new Date(consent.signedAt) : null,
          fileUrl: consent.fileUrl,
        }))
      );

      return patient.id;
    });

    const detail = await getById(result);
    if (!detail) {
      throw new Error('patient_not_found_after_create');
    }
    return detail;
  };

  const softDelete = async (patientId: string) => {
    const [updated] = await database
      .update(patients)
      .set({
        status: 'archived',
        deletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)))
      .returning();

    return Boolean(updated);
  };

  const anonymize = async (cutoffDate: Date) => {
    const targets = await database
      .select({ id: patients.id, reference: patients.reference })
      .from(patients)
      .where(
        and(
          not(isNull(patients.deletedAt)),
          lte(patients.deletedAt, cutoffDate),
          isNull(patients.anonymizedAt)
        )
      );

    if (!targets.length) return 0;

    await database.transaction(async (tx) => {
      for (const patient of targets) {
        const placeholder = `ANON-${patient.reference}`;
        await tx
          .update(patients)
          .set({
            fullName: placeholder,
            preferredName: null,
            email: null,
            phone: null,
            notes: null,
            anonymizedAt: sql`NOW()`,
            updatedAt: sql`NOW()`,
          })
          .where(eq(patients.id, patient.id));

        await tx
          .update(patientContacts)
          .set({ value: 'REDACTED', updatedAt: sql`NOW()` })
          .where(eq(patientContacts.patientId, patient.id));
      }
    });

    return targets.length;
  };

  return {
    list,
    getById,
    create,
    softDelete,
    anonymize,
  };
};

export const patientService = createPatientService();
