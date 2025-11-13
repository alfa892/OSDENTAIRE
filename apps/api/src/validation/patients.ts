import { z } from 'zod';

export const contactInputSchema = z.object({
  type: z.enum(['phone', 'email', 'emergency']),
  label: z.string().min(2).max(64),
  value: z.string().min(3).max(128),
  isPrimary: z.boolean().optional().default(false),
});

export const consentInputSchema = z.object({
  template: z.string().min(3).max(128),
  version: z.string().min(1).max(16).default('v1'),
  status: z.enum(['pending', 'signed']).default('pending'),
  signedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().datetime())
    .optional(),
  fileUrl: z.string().url().optional(),
});

export const createPatientSchema = z.object({
  fullName: z.string().min(2).max(120),
  preferredName: z.string().min(2).max(60).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(32),
  activeTreatment: z.string().min(3).max(160).optional(),
  nextVisit: z
    .string()
    .datetime({ offset: true })
    .or(z.string().datetime())
    .optional(),
  balance: z.number().nonnegative().max(100000).default(0),
  notes: z.string().max(2000).optional(),
  contacts: z.array(contactInputSchema).min(1).max(5),
  consentForms: z.array(consentInputSchema).max(5).optional(),
});

export const listPatientsQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
  status: z.enum(['active', 'archived']).optional().default('active'),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  offset: z.coerce.number().min(0).max(1000).optional().default(0),
});

export const patientIdParamSchema = z.object({
  id: z.string().uuid(),
});
