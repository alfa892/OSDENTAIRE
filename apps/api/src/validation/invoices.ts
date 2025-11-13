import { z } from 'zod';

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

const payerInputSchema = z.object({
  name: z.string().min(3).max(120),
  type: z.enum(['patient', 'mutuelle', 'insurance', 'third_party']).default('patient'),
  email: z.string().email().optional(),
  phone: z.string().max(64).optional(),
  addressLine1: z.string().max(160).optional(),
  postalCode: z.string().max(16).optional(),
  city: z.string().max(80).optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(3).max(160),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  unitPrice: z.coerce.number().min(0).max(50000),
  taxRateBps: z.coerce.number().int().min(0).max(10000).optional(),
});

const insuranceClaimSchema = z.object({
  payerId: z.string().uuid().optional(),
  payer: payerInputSchema.extend({ type: z.enum(['mutuelle', 'insurance']).default('mutuelle') }).optional(),
  coveragePercent: z.coerce.number().int().min(0).max(100).optional(),
  coveredAmount: z.coerce.number().min(0).max(100000).optional(),
  claimNumber: z.string().max(64).optional(),
  filedAt: isoDateTime.optional(),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  payerId: z.string().uuid().optional(),
  payer: payerInputSchema.optional(),
  dueDate: isoDateTime,
  notes: z.string().max(1000).optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  insuranceClaim: insuranceClaimSchema.optional(),
  issueNow: z.coerce.boolean().optional(),
});

export const addInvoiceItemsSchema = z.object({
  items: z.array(invoiceItemSchema).min(1),
  issueNow: z.coerce.boolean().optional(),
});

export const addPaymentSchema = z.object({
  amount: z.coerce.number().positive().max(100000),
  method: z.string().min(3).max(60).default('card'),
  source: z.enum(['patient', 'mutuelle', 'insurance', 'other']).default('patient'),
  reference: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
  paidAt: isoDateTime.optional(),
  payerId: z.string().uuid().optional(),
  payer: payerInputSchema.optional(),
});

export const listInvoicesQuerySchema = z.object({
  status: z.enum(['draft', 'issued', 'paid']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().min(2).max(120).optional(),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid(),
});
