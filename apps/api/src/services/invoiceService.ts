import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import { config } from '../config';
import { db, dbSchema } from '../db/client';
import {
  insuranceClaims,
  invoices,
  invoiceItems,
  payers,
  payments,
  patients,
  type InvoiceStatus,
  type PaymentSource,
} from '../db/schema';
import { generateInvoicePdf, type InvoicePdfPayload } from './invoicePdf';
import { createInvoiceStorage, type InvoiceStorage } from './invoiceStorage';
import { createInvoiceMailer, type InvoiceMailer } from './invoiceMailer';
import {
  createInvoiceSchema,
  addInvoiceItemsSchema,
  addPaymentSchema,
  listInvoicesQuerySchema,
} from '../validation/invoices';
import type { z } from 'zod';

export class InvoiceError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
    this.name = 'InvoiceError';
  }
}

type InvoiceDb = NodePgDatabase<typeof dbSchema> | PgliteDatabase<typeof dbSchema>;

type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
type AddItemsInput = z.infer<typeof addInvoiceItemsSchema>;
type AddPaymentInput = z.infer<typeof addPaymentSchema>;
type ListQueryInput = z.infer<typeof listInvoicesQuerySchema>;

export type InvoiceListItem = {
  id: string;
  reference: string;
  status: InvoiceStatus;
  dueDate: string;
  total: number;
  balance: number;
  patient: { id: string; fullName: string };
  payer: { id: string; name: string; type: string };
  pdfUrl: string | null;
};

export type InvoiceDetail = {
  id: string;
  reference: string;
  status: InvoiceStatus;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    paid: number;
    balance: number;
  };
  patient: { id: string; fullName: string; reference: string };
  payer: { id: string; name: string; type: string; email: string | null };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalExclTax: number;
    totalInclTax: number;
  }>;
  payments: Array<{
    id: string;
    source: PaymentSource;
    method: string;
    reference: string | null;
    notes: string | null;
    amount: number;
    paidAt: string;
  }>;
  insuranceClaim: null | {
    id: string;
    status: string;
    coveragePercent: number;
    coveredAmount: number;
    claimNumber: string | null;
  };
  pdfUrl: string | null;
};

export type InvoiceService = ReturnType<typeof createInvoiceService>;

const euroFromCents = (value: number) => Number((value / 100).toFixed(2));
const centsFromEuro = (value: number) => Math.round(value * 100);
const reference = () => `INV-${nanoid(6).toUpperCase()}`;

const asDate = (value: string | Date) => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvoiceError('invalid_date', 422);
  }
  return parsed;
};

type InvoiceDeps = {
  storage?: InvoiceStorage;
  mailer?: InvoiceMailer;
  pdfGenerator?: typeof generateInvoicePdf;
  taxRate?: number;
};

const toPdfPayload = (detail: InvoiceDetail): InvoicePdfPayload => ({
  invoice: {
    reference: detail.reference,
    issuedAt: detail.issuedAt,
    dueDate: detail.dueDate,
    notes: detail.notes,
    status: detail.status,
    totals: {
      subtotalCents: Math.round(detail.totals.subtotal * 100),
      taxCents: Math.round(detail.totals.tax * 100),
      totalCents: Math.round(detail.totals.total * 100),
      paidCents: Math.round(detail.totals.paid * 100),
      balanceCents: Math.round(detail.totals.balance * 100),
    },
  },
  patient: detail.patient,
  payer: detail.payer,
  items: detail.items.map((item) => {
    const exclCents = Math.round(item.totalExclTax * 100);
    const inclCents = Math.round(item.totalInclTax * 100);
    return {
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: Math.round(item.unitPrice * 100),
      taxRateBps: Math.round(item.taxRate * 10000),
      totalExclTaxCents: exclCents,
      totalTaxCents: Math.max(inclCents - exclCents, 0),
    };
  }),
  payments: detail.payments.map((payment) => ({
    source: payment.source,
    method: payment.method,
    amountCents: Math.round(payment.amount * 100),
    paidAt: payment.paidAt,
    reference: payment.reference,
  })),
});

export const createInvoiceService = (database: InvoiceDb = db, deps: InvoiceDeps = {}) => {
  const storage = deps.storage ?? createInvoiceStorage();
  const mailer = deps.mailer ?? createInvoiceMailer();
  const pdfGenerator = deps.pdfGenerator ?? generateInvoicePdf;
  const defaultTaxRate = deps.taxRate ?? config.tvaRate;
  const defaultTaxRateBps = Math.round(defaultTaxRate * 10000);

  const loadInvoice = async (adapter: InvoiceDb, id: string) =>
    adapter.query.invoices.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      with: {
        patient: true,
        payer: true,
        items: {
          orderBy: (table, { asc }) => [asc(table.createdAt)],
        },
        payments: {
          orderBy: (table, { asc }) => [asc(table.paidAt)],
        },
        claims: {
          orderBy: (table, { asc }) => [asc(table.createdAt)],
        },
      },
    });

  const mapDetail = async (
    adapter: InvoiceDb,
    invoiceId: string,
    shouldRefreshPdf = true
  ): Promise<InvoiceDetail | null> => {
    const record = await loadInvoice(adapter, invoiceId);
    if (!record) return null;

    let pdfUrl = record.pdfSignedUrl ?? null;
    if (shouldRefreshPdf && record.pdfStorageKey) {
      const expired =
        !record.pdfSignedUrlExpiresAt || record.pdfSignedUrlExpiresAt.getTime() < Date.now() + 60 * 1000;
      if (!record.pdfSignedUrl || expired) {
        try {
          pdfUrl = await storage.getSignedUrl(record.pdfStorageKey);
          await adapter
            .update(invoices)
            .set({
              pdfSignedUrl: pdfUrl,
              pdfSignedUrlExpiresAt: new Date(Date.now() + config.pdfSignedUrlTtlSeconds * 1000),
            })
            .where(eq(invoices.id, invoiceId));
        } catch (error) {
          console.error('invoice_pdf_sign_failed', error);
        }
      }
    }

    const totals = {
      subtotal: euroFromCents(record.totalExclTaxCents ?? 0),
      tax: euroFromCents(record.totalTaxCents ?? 0),
      total: euroFromCents(record.totalInclTaxCents ?? 0),
      paid: euroFromCents(record.paidAmountCents ?? 0),
      balance: euroFromCents((record.totalInclTaxCents ?? 0) - (record.paidAmountCents ?? 0)),
    };

    return {
      id: record.id,
      reference: record.reference,
      status: record.status,
      dueDate: record.dueDate.toISOString(),
      issuedAt: record.issuedAt ? record.issuedAt.toISOString() : null,
      paidAt: record.paidAt ? record.paidAt.toISOString() : null,
      notes: record.notes ?? null,
      totals,
      patient: {
        id: record.patient.id,
        fullName: record.patient.fullName,
        reference: record.patient.reference,
      },
      payer: {
        id: record.payer.id,
        name: record.payer.name,
        type: record.payer.type,
        email: record.payer.email ?? null,
      },
      items: record.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: euroFromCents(item.unitPriceCents),
        taxRate: item.taxRateBps / 10000,
        totalExclTax: euroFromCents(item.totalExclTaxCents),
        totalInclTax: euroFromCents(item.totalExclTaxCents + item.totalTaxCents),
      })),
      payments: record.payments.map((payment) => ({
        id: payment.id,
        source: payment.source,
        method: payment.method,
        reference: payment.reference ?? null,
        notes: payment.notes ?? null,
        amount: euroFromCents(payment.amountCents),
        paidAt: payment.paidAt.toISOString(),
      })),
      insuranceClaim: record.claims[0]
        ? {
            id: record.claims[0].id,
            status: record.claims[0].status,
            coveragePercent: record.claims[0].coveragePercent,
            coveredAmount: euroFromCents(record.claims[0].coveredAmountCents ?? 0),
            claimNumber: record.claims[0].claimNumber ?? null,
          }
        : null,
      pdfUrl,
    };
  };

  const ensurePatient = async (patientId: string) => {
    const patient = await database.query.patients.findFirst({ where: (table, { eq }) => eq(table.id, patientId) });
    if (!patient) {
      throw new InvoiceError('patient_not_found', 404);
    }
    return patient;
  };

  const ensurePayer = async (adapter: InvoiceDb, payload: CreateInvoiceInput, patient: typeof patients.$inferSelect) => {
    if (payload.payerId) {
      const existing = await adapter.query.payers.findFirst({ where: (table, { eq }) => eq(table.id, payload.payerId!) });
      if (!existing) {
        throw new InvoiceError('payer_not_found', 404);
      }
      return existing.id;
    }

    if (payload.payer) {
      const [created] = await adapter
        .insert(payers)
        .values({
          id: randomUUID(),
          type: payload.payer.type,
          name: payload.payer.name,
          email: payload.payer.email,
          phone: payload.payer.phone,
          addressLine1: payload.payer.addressLine1,
          postalCode: payload.payer.postalCode,
          city: payload.payer.city,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: payers.id });
      return created.id;
    }

    const [found] = await adapter
      .insert(payers)
      .values({
        id: randomUUID(),
        patientId: patient.id,
        type: 'patient',
        name: patient.fullName,
        email: patient.email,
        phone: patient.phone,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: payers.id });
    return found.id;
  };

  const resolveClaimPayer = async (
    adapter: InvoiceDb,
    claim: NonNullable<CreateInvoiceInput['insuranceClaim']>,
    fallback: string
  ) => {
    if (claim.payerId) {
      return claim.payerId;
    }
    if (claim.payer) {
      const [created] = await adapter
        .insert(payers)
        .values({
          id: randomUUID(),
          type: claim.payer.type,
          name: claim.payer.name,
          email: claim.payer.email,
          phone: claim.payer.phone,
          addressLine1: claim.payer.addressLine1,
          postalCode: claim.payer.postalCode,
          city: claim.payer.city,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: payers.id });
      return created.id;
    }
    return fallback;
  };

  const insertItems = async (adapter: InvoiceDb, invoiceId: string, items: AddItemsInput['items']) => {
    for (const item of items) {
      const unitPriceCents = centsFromEuro(item.unitPrice);
      const quantity = item.quantity ?? 1;
      const subtotal = unitPriceCents * quantity;
      const taxRate = item.taxRateBps ?? defaultTaxRateBps;
      const tax = Math.round((subtotal * taxRate) / 10000);
      await adapter.insert(invoiceItems).values({
        id: randomUUID(),
        invoiceId,
        description: item.description,
        quantity,
        unitPriceCents,
        taxRateBps: taxRate,
        totalExclTaxCents: subtotal,
        totalTaxCents: tax,
      });
    }
  };

  const recomputeTotals = async (adapter: InvoiceDb, invoiceId: string) => {
    const [row] = await adapter
      .select({
        subtotal: sql<number>`COALESCE(sum(${invoiceItems.totalExclTaxCents}),0)` ,
        tax: sql<number>`COALESCE(sum(${invoiceItems.totalTaxCents}),0)` ,
      })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    const subtotal = Number(row?.subtotal ?? 0);
    const tax = Number(row?.tax ?? 0);
    const total = subtotal + tax;

    await adapter
      .update(invoices)
      .set({
        totalExclTaxCents: subtotal,
        totalTaxCents: tax,
        totalInclTaxCents: total,
        updatedAt: sql`NOW()`,
        pdfSignedUrl: null,
        pdfSignedUrlExpiresAt: null,
      })
      .where(eq(invoices.id, invoiceId));

    return { subtotal, total };
  };

  const refreshPaidAmount = async (adapter: InvoiceDb, invoiceId: string) => {
    const [row] = await adapter
      .select({ paid: sql<number>`COALESCE(sum(${payments.amountCents}),0)` })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));
    const paid = Number(row?.paid ?? 0);
    await adapter
      .update(invoices)
      .set({ paidAmountCents: paid, updatedAt: sql`NOW()` })
      .where(eq(invoices.id, invoiceId));
    return paid;
  };

  const ensureIssued = async (adapter: InvoiceDb, invoiceId: string) => {
    const detail = await adapter.query.invoices.findFirst({ where: (table, { eq }) => eq(table.id, invoiceId) });
    if (!detail) throw new InvoiceError('invoice_not_found', 404);
    if ((detail.totalInclTaxCents ?? 0) <= 0) {
      throw new InvoiceError('invoice_empty', 422);
    }
    const alreadyIssued = detail.status === 'issued';
    const now = new Date();
    await adapter
      .update(invoices)
      .set({ status: 'issued', issuedAt: detail.issuedAt ?? now, updatedAt: sql`NOW()` })
      .where(eq(invoices.id, invoiceId));

    const mapped = await mapDetail(adapter, invoiceId, false);
    if (!mapped) return; // should not happen
    const key = `invoices/${mapped.reference}-${Date.now()}.pdf`;
    let signedUrl: string | null = null;
    try {
      const buffer = await pdfGenerator(toPdfPayload(mapped));
      await storage.uploadPdf(key, buffer);
      signedUrl = await storage.getSignedUrl(key);
      await adapter
        .update(invoices)
        .set({
          pdfStorageKey: key,
          pdfSignedUrl: signedUrl,
          pdfSignedUrlExpiresAt: new Date(Date.now() + config.pdfSignedUrlTtlSeconds * 1000),
        })
        .where(eq(invoices.id, invoiceId));
    } catch (error) {
      console.error('invoice_pdf_generation_failed', error);
      await adapter
        .update(invoices)
        .set({ pdfStorageKey: null, pdfSignedUrl: null, pdfSignedUrlExpiresAt: null })
        .where(eq(invoices.id, invoiceId));
    }
    if (!alreadyIssued) {
      await mailer.sendIssued({
        reference: mapped.reference,
        totalCents: Math.round(mapped.totals.total * 100),
        email: mapped.payer.email,
        pdfUrl: signedUrl,
      });
    }
  };

  const list = async (rawInput: Partial<ListQueryInput> = {}) => {
    const input = listInvoicesQuerySchema.parse(rawInput);
    const filters: SQL<unknown>[] = [];
    if (input.status) {
      filters.push(eq(invoices.status, input.status));
    }
    if (input.q) {
      const like = `%${input.q}%`;
      filters.push(
        or(ilike(invoices.reference, like), ilike(patients.fullName, like), ilike(payers.name, like)) as SQL<unknown>
      );
    }

    const base = database
      .select({
        id: invoices.id,
        reference: invoices.reference,
        status: invoices.status,
        dueDate: invoices.dueDate,
        total: invoices.totalInclTaxCents,
        balance: sql<number>`(${invoices.totalInclTaxCents} - ${invoices.paidAmountCents})`,
        patientId: patients.id,
        patientName: patients.fullName,
        payerId: payers.id,
        payerName: payers.name,
        payerType: payers.type,
        pdfUrl: invoices.pdfSignedUrl,
      })
      .from(invoices)
      .innerJoin(patients, eq(patients.id, invoices.patientId))
      .innerJoin(payers, eq(payers.id, invoices.payerId));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const query = whereClause ? base.where(whereClause) : base;
    const rows = await query.orderBy(desc(invoices.createdAt)).limit(input.limit).offset(input.offset);

    const countBase = database
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .innerJoin(patients, eq(patients.id, invoices.patientId))
      .innerJoin(payers, eq(payers.id, invoices.payerId));
    const countQuery = whereClause ? countBase.where(whereClause) : countBase;
    const countRows = await countQuery;

    return {
      data: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
        dueDate: row.dueDate.toISOString(),
        total: euroFromCents(row.total ?? 0),
        balance: euroFromCents(row.balance ?? 0),
        patient: { id: row.patientId, fullName: row.patientName },
        payer: { id: row.payerId, name: row.payerName, type: row.payerType },
        pdfUrl: row.pdfUrl ?? null,
      })),
      meta: { total: countRows[0]?.count ?? 0, limit: input.limit, offset: input.offset },
    } satisfies { data: InvoiceListItem[]; meta: { total: number; limit: number; offset: number } };
  };

  const getById = async (invoiceId: string) => {
    return mapDetail(database, invoiceId);
  };

  const create = async (rawInput: CreateInvoiceInput) => {
    const input = createInvoiceSchema.parse(rawInput);
    const patient = await ensurePatient(input.patientId);
    return database.transaction(async (trx) => {
      const tx = trx as unknown as InvoiceDb;
      const payerId = await ensurePayer(tx, input, patient);
      const [created] = await tx
        .insert(invoices)
        .values({
          id: randomUUID(),
          reference: reference(),
          patientId: patient.id,
          payerId,
          dueDate: asDate(input.dueDate),
          notes: input.notes ?? null,
          status: 'draft',
        })
        .returning({ id: invoices.id });

      if (input.items) {
        await insertItems(tx, created.id, input.items);
        await recomputeTotals(tx, created.id);
      }

      if (input.insuranceClaim) {
        const claimPayerId = await resolveClaimPayer(tx, input.insuranceClaim, payerId);
        await tx.insert(insuranceClaims).values({
          id: randomUUID(),
          invoiceId: created.id,
          payerId: claimPayerId,
          status: input.insuranceClaim.claimNumber ? 'submitted' : 'draft',
          claimNumber: input.insuranceClaim.claimNumber,
          coveragePercent: input.insuranceClaim.coveragePercent ?? 0,
          coveredAmountCents: input.insuranceClaim.coveredAmount
            ? centsFromEuro(input.insuranceClaim.coveredAmount)
            : 0,
          filedAt: input.insuranceClaim.filedAt ? asDate(input.insuranceClaim.filedAt) : new Date(),
        });
      }

      if (input.issueNow || input.items?.length) {
        const detail = await tx.query.invoices.findFirst({ where: (table, { eq }) => eq(table.id, created.id) });
        if (detail && detail.totalInclTaxCents > 0) {
          await ensureIssued(tx, created.id);
        }
      }

      return mapDetail(tx, created.id);
    });
  };

  const addItems = async (invoiceId: string, rawInput: AddItemsInput) => {
    const input = addInvoiceItemsSchema.parse(rawInput);
    return database.transaction(async (trx) => {
      const tx = trx as unknown as InvoiceDb;
      const invoice = await tx.query.invoices.findFirst({ where: (table, { eq }) => eq(table.id, invoiceId) });
      if (!invoice) throw new InvoiceError('invoice_not_found', 404);
      if (invoice.status === 'paid') {
        throw new InvoiceError('invoice_paid', 409);
      }
      await insertItems(tx, invoiceId, input.items);
      await recomputeTotals(tx, invoiceId);
      if (input.issueNow || invoice.status === 'issued') {
        await ensureIssued(tx, invoiceId);
      }
      return mapDetail(tx, invoiceId);
    });
  };

  const addPayment = async (invoiceId: string, rawInput: AddPaymentInput) => {
    const input = addPaymentSchema.parse(rawInput);
    return database.transaction(async (trx) => {
      const tx = trx as unknown as InvoiceDb;
      const invoice = await tx.query.invoices.findFirst({ where: (table, { eq }) => eq(table.id, invoiceId) });
      if (!invoice) throw new InvoiceError('invoice_not_found', 404);
      if (invoice.status === 'draft') {
        throw new InvoiceError('invoice_not_issued', 409);
      }
      if (invoice.status === 'paid') {
        throw new InvoiceError('invoice_paid', 409);
      }
      let payerId = input.payerId ?? invoice.payerId;
      if (!input.payerId && input.payer) {
        const [createdPayer] = await tx
          .insert(payers)
          .values({
            id: randomUUID(),
            type: input.payer.type,
            name: input.payer.name,
            email: input.payer.email,
            phone: input.payer.phone,
            addressLine1: input.payer.addressLine1,
            postalCode: input.payer.postalCode,
            city: input.payer.city,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: payers.id });
        payerId = createdPayer.id;
      }

      await tx.insert(payments).values({
        id: randomUUID(),
        invoiceId,
        payerId,
        source: input.source,
        method: input.method,
        amountCents: centsFromEuro(input.amount),
        notes: input.notes,
        reference: input.reference,
        paidAt: input.paidAt ? asDate(input.paidAt) : new Date(),
      });

      const paid = await refreshPaidAmount(tx, invoiceId);
      if (paid >= (invoice.totalInclTaxCents ?? 0)) {
        await tx
          .update(invoices)
          .set({ status: 'paid', paidAt: input.paidAt ? asDate(input.paidAt) : new Date(), updatedAt: sql`NOW()` })
          .where(eq(invoices.id, invoiceId));
      }
      const detail = await mapDetail(tx, invoiceId);
      if (detail?.payer.email) {
        await mailer.sendPaymentReceipt({
          reference: detail.reference,
          amountCents: Math.round(input.amount * 100),
          email: detail.payer.email,
          paymentDate: (input.paidAt ? asDate(input.paidAt) : new Date()).toISOString(),
        });
      }
      return detail;
    });
  };

  return {
    list,
    getById,
    create,
    addItems,
    addPayment,
  };
};
