import { z } from 'zod';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())
  .optional();

const toUuidArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => `${entry}`.split(',')).map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (value == null) return undefined;
  return [`${value}`.trim()].filter(Boolean);
};

export const listAppointmentsQuerySchema = z.object({
  start: isoDate,
  end: isoDate,
  providerId: z
    .preprocess(toUuidArray, z.array(z.string().uuid()).min(1))
    .optional(),
  roomId: z
    .preprocess(toUuidArray, z.array(z.string().uuid()).min(1))
    .optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
  includeNotes: z.coerce.boolean().optional().default(false),
});

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const noteInputSchema = z.object({
  body: z.string().min(3).max(500),
});

export const createAppointmentSchema = z.object({
  providerId: z.string().uuid(),
  roomId: z.string().uuid(),
  patientId: z.string().uuid(),
  title: z.string().min(3).max(160),
  startAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().datetime()),
  durationMinutes: z.coerce.number().int().min(5).max(240).optional(),
  notes: z.array(noteInputSchema).max(3).optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(3).max(240).optional(),
});
