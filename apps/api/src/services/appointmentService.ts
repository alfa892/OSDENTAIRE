import { and, asc, eq, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { db, dbSchema } from '../db/client';
import {
  appointmentNotes,
  appointments,
  patients,
  providers,
  rooms,
  type AppointmentNoteType,
} from '../db/schema';
import type { Role } from '../types/auth';
import { cancelAppointmentSchema, createAppointmentSchema, listAppointmentsQuerySchema } from '../validation/appointments';
import type { z } from 'zod';
import { AppointmentRealtime, appointmentRealtime } from './appointmentRealtime';

const PARIS_TZ = 'Europe/Paris';

export class AppointmentError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
    this.name = 'AppointmentError';
  }
}

type AppointmentDb = NodePgDatabase<typeof dbSchema> | PgliteDatabase<typeof dbSchema>;

type ListInput = z.infer<typeof listAppointmentsQuerySchema>;
type CreateInput = z.infer<typeof createAppointmentSchema>;
type CancelInput = z.infer<typeof cancelAppointmentSchema>;

export type AppointmentNoteDTO = {
  id: string;
  authorRole: string;
  authorName: string;
  kind: AppointmentNoteType;
  body: string;
  createdAt: string;
};

export type ProviderSummary = {
  id: string;
  fullName: string;
  initials: string;
  specialty: string | null;
  role: string;
  color: string;
  nextAvailableAt: string | null;
};

export type RoomSummary = {
  id: string;
  name: string;
  color: string;
  floor: string | null;
  equipment: string | null;
};

export type AppointmentDTO = {
  id: string;
  title: string;
  status: 'scheduled' | 'cancelled';
  timezone: string;
  startAt: string;
  endAt: string;
  slotMinutes: number;
  provider: {
    id: string;
    fullName: string;
    initials: string;
    color: string;
  };
  room: {
    id: string;
    name: string;
    color: string;
  };
  patient: {
    id: string;
    fullName: string;
    reference: string;
  };
  cancelReason: string | null;
  canceledAt: string | null;
  createdBy: string;
  createdByRole: string;
  notes: AppointmentNoteDTO[];
};

const toParisDateTime = (value: string) => {
  const dt = DateTime.fromISO(value, { setZone: true });
  if (!dt.isValid) {
    throw new AppointmentError('invalid_datetime', 422);
  }
  return dt.setZone(PARIS_TZ);
};

const slotAligned = (date: DateTime, slot: number) => date.minute % slot === 0 && date.second === 0 && date.millisecond === 0;

const mapAppointment = (row: {
  id: string;
  title: string;
  status: 'scheduled' | 'cancelled';
  timezone: string;
  startAt: Date;
  endAt: Date;
  slotMinutes: number;
  provider: {
    id: string;
    fullName: string;
    initials: string;
    color: string;
  };
  room: {
    id: string;
    name: string;
    color: string;
  };
  patient: {
    id: string;
    fullName: string;
    reference: string;
  };
  cancelReason: string | null;
  canceledAt: Date | null;
  createdBy: string;
  createdByRole: string;
  notes?: AppointmentNoteDTO[];
}): AppointmentDTO => ({
  id: row.id,
  title: row.title,
  status: row.status,
  timezone: row.timezone,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  slotMinutes: row.slotMinutes,
  provider: row.provider,
  room: row.room,
  patient: row.patient,
  cancelReason: row.cancelReason,
  canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
  createdBy: row.createdBy,
  createdByRole: row.createdByRole,
  notes: row.notes ?? [],
});

const computeRange = (input: ListInput) => {
  const now = DateTime.now().setZone(PARIS_TZ);
  const startInput = input.start ? toParisDateTime(input.start) : now.startOf('week');
  const endInput = input.end ? toParisDateTime(input.end) : startInput.plus({ days: 7 });
  if (endInput <= startInput) {
    throw new AppointmentError('invalid_range', 422);
  }
  return { start: startInput.startOf('minute'), end: endInput.startOf('minute') };
};

const refreshProviderAvailability = async (database: AppointmentDb, providerId: string) => {
  const [nextSlot] = await database
    .select({ startAt: appointments.startAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.providerId, providerId),
        eq(appointments.status, 'scheduled'),
        gt(appointments.startAt, new Date())
      )
    )
    .orderBy(asc(appointments.startAt))
    .limit(1);

  await database
    .update(providers)
    .set({ nextAvailableAt: nextSlot?.startAt ?? null, updatedAt: sql`NOW()` })
    .where(eq(providers.id, providerId));
};

export const createAppointmentService = (
  database: AppointmentDb = db,
  realtime: AppointmentRealtime<AppointmentDTO> = appointmentRealtime
) => {
  const list = async (rawInput: Partial<ListInput> = {}) => {
    const parsed = listAppointmentsQuerySchema.parse(rawInput);
    const range = computeRange(parsed);

    const filters = [
      gte(appointments.startAt, range.start.toUTC().toJSDate()),
      lt(appointments.startAt, range.end.toUTC().toJSDate()),
    ];

    if (parsed.status) {
      filters.push(eq(appointments.status, parsed.status));
    }

    if (parsed.providerId) {
      filters.push(inArray(appointments.providerId, parsed.providerId));
    }

    if (parsed.roomId) {
      filters.push(inArray(appointments.roomId, parsed.roomId));
    }

    const rows = await database
      .select({
        id: appointments.id,
        title: appointments.title,
        status: appointments.status,
        timezone: appointments.timezone,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        slotMinutes: appointments.slotMinutes,
        provider: {
          id: providers.id,
          fullName: providers.fullName,
          initials: providers.initials,
          color: providers.color,
        },
        room: {
          id: rooms.id,
          name: rooms.name,
          color: rooms.color,
        },
        patient: {
          id: patients.id,
          fullName: patients.fullName,
          reference: patients.reference,
        },
        cancelReason: appointments.cancelReason,
        canceledAt: appointments.canceledAt,
        createdBy: appointments.createdBy,
        createdByRole: appointments.createdByRole,
      })
      .from(appointments)
      .innerJoin(providers, eq(providers.id, appointments.providerId))
      .innerJoin(rooms, eq(rooms.id, appointments.roomId))
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(and(...filters))
      .orderBy(asc(appointments.startAt));

    let notesByAppointment = new Map<string, AppointmentNoteDTO[]>();
    if (parsed.includeNotes && rows.length > 0) {
      const noteRows = await database
        .select({
          id: appointmentNotes.id,
          appointmentId: appointmentNotes.appointmentId,
          authorRole: appointmentNotes.authorRole,
          authorName: appointmentNotes.authorName,
          kind: appointmentNotes.kind,
          body: appointmentNotes.body,
          createdAt: appointmentNotes.createdAt,
        })
        .from(appointmentNotes)
        .where(inArray(appointmentNotes.appointmentId, rows.map((row) => row.id)))
        .orderBy(asc(appointmentNotes.createdAt));

      notesByAppointment = noteRows.reduce((map, note) => {
        const current = map.get(note.appointmentId) ?? [];
        current.push({
          id: note.id,
          authorRole: note.authorRole,
          authorName: note.authorName,
          kind: note.kind,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
        });
        map.set(note.appointmentId, current);
        return map;
      }, new Map<string, AppointmentNoteDTO[]>());
    }

    const data = rows.map((row) =>
      mapAppointment({
        ...row,
        notes: notesByAppointment.get(row.id),
      })
    );

    const providerListRows = await database
      .select({
        id: providers.id,
        fullName: providers.fullName,
        initials: providers.initials,
        specialty: providers.specialty,
        role: providers.role,
        color: providers.color,
        nextAvailableAt: providers.nextAvailableAt,
      })
      .from(providers)
      .where(eq(providers.isActive, true))
      .orderBy(asc(providers.fullName));

    const roomListRows = await database
      .select({
        id: rooms.id,
        name: rooms.name,
        color: rooms.color,
        floor: rooms.floor,
        equipment: rooms.equipment,
      })
      .from(rooms)
      .orderBy(asc(rooms.name));

    const providersDto: ProviderSummary[] = providerListRows.map((provider) => ({
      id: provider.id,
      fullName: provider.fullName,
      initials: provider.initials,
      specialty: provider.specialty ?? null,
      role: provider.role,
      color: provider.color,
      nextAvailableAt: provider.nextAvailableAt ? provider.nextAvailableAt.toISOString() : null,
    }));

    const roomsDto: RoomSummary[] = roomListRows.map((room) => ({
      id: room.id,
      name: room.name,
      color: room.color,
      floor: room.floor ?? null,
      equipment: room.equipment ?? null,
    }));

    return {
      data,
      providers: providersDto,
      rooms: roomsDto,
      meta: {
        start: range.start.toUTC().toISO(),
        end: range.end.toUTC().toISO(),
        timezone: PARIS_TZ,
        cursor: realtime.getCursor(),
      },
    };
  };

  const getById = async (appointmentId: string, includeNotes = true) => {
    const row = await database.query.appointments.findFirst({
      where: (table, { eq }) => eq(table.id, appointmentId),
      with: {
        provider: true,
        room: true,
        patient: true,
        notes: includeNotes,
      },
    });

    if (!row) {
      return null;
    }

    const notes = row.notes?.map((note) => ({
      id: note.id,
      authorRole: note.authorRole,
      authorName: note.authorName,
      kind: note.kind,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    }));

    return mapAppointment({ ...row, notes });
  };

  const create = async (rawInput: CreateInput, user: Express.UserContext) => {
    const parsed = createAppointmentSchema.parse(rawInput);
    const start = toParisDateTime(parsed.startAt).startOf('minute');
    const provider = await database.query.providers.findFirst({
      where: (table, { eq }) => eq(table.id, parsed.providerId),
    });
    if (!provider) {
      throw new AppointmentError('provider_not_found', 404);
    }
    const room = await database.query.rooms.findFirst({
      where: (table, { eq }) => eq(table.id, parsed.roomId),
    });
    if (!room) {
      throw new AppointmentError('room_not_found', 404);
    }
    const patient = await database.query.patients.findFirst({
      where: (table, { eq }) => eq(table.id, parsed.patientId),
    });
    if (!patient) {
      throw new AppointmentError('patient_not_found', 404);
    }

    const baseSlot = config.appointmentSlotMinutes;
    if (!slotAligned(start, baseSlot)) {
      throw new AppointmentError('invalid_slot_alignment', 422);
    }

    const slotMinutes = parsed.durationMinutes ?? provider.defaultDurationMinutes ?? baseSlot;
    if (slotMinutes % baseSlot !== 0) {
      throw new AppointmentError('invalid_slot_duration', 422);
    }

    const end = start.plus({ minutes: slotMinutes });

    const overlap = await database
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'scheduled'),
          lt(appointments.startAt, end.toUTC().toJSDate()),
          gt(appointments.endAt, start.toUTC().toJSDate()),
          or(eq(appointments.providerId, parsed.providerId), eq(appointments.roomId, parsed.roomId))
        )
      )
      .limit(1);

    if (overlap.length > 0) {
      throw new AppointmentError('double_booking', 409);
    }

    const createdId = randomUUID();

    await database.transaction(async (tx) => {
      await tx.insert(appointments).values({
        id: createdId,
        providerId: parsed.providerId,
        roomId: parsed.roomId,
        patientId: parsed.patientId,
        title: parsed.title,
        status: 'scheduled',
        timezone: PARIS_TZ,
        startAt: start.toUTC().toJSDate(),
        endAt: end.toUTC().toJSDate(),
        slotMinutes,
        createdBy: user.id,
        createdByRole: user.role,
      });

      const notesPayload = parsed.notes?.map((note) => ({
        id: randomUUID(),
        appointmentId: createdId,
        authorRole: user.role,
        authorName: user.id,
        kind: 'note' as const,
        body: note.body,
      }));
      if (notesPayload?.length) {
        await tx.insert(appointmentNotes).values(notesPayload);
      }

      await tx.insert(appointmentNotes).values({
        id: randomUUID(),
        appointmentId: createdId,
        authorRole: user.role,
        authorName: user.id,
        kind: 'notification',
        body: `Créneau créé par ${user.role}`,
      });

      await refreshProviderAvailability(tx, parsed.providerId);
    });

    const detail = await getById(createdId);
    if (!detail) {
      throw new AppointmentError('appointment_not_found', 500);
    }

    realtime.emit({ type: 'appointment.created', data: detail });
    return detail;
  };

  const cancel = async (appointmentId: string, rawInput: CancelInput, user: Express.UserContext) => {
    const parsedBody = cancelAppointmentSchema.parse(rawInput ?? {});
    const appointment = await database.query.appointments.findFirst({
      where: (table, { eq }) => eq(table.id, appointmentId),
    });

    if (!appointment) {
      throw new AppointmentError('appointment_not_found', 404);
    }

    if (appointment.status === 'cancelled') {
      return getById(appointmentId);
    }

    await database.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({
          status: 'cancelled',
          cancelReason: parsedBody.reason ?? null,
          canceledAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(appointments.id, appointmentId));

      await tx.insert(appointmentNotes).values({
        id: randomUUID(),
        appointmentId,
        authorRole: user.role,
        authorName: user.id,
        kind: 'notification',
        body: parsedBody.reason ? `Annulé: ${parsedBody.reason}` : 'Annulé',
      });

      await refreshProviderAvailability(tx, appointment.providerId);
    });

    const detail = await getById(appointmentId);
    if (!detail) {
      throw new AppointmentError('appointment_not_found', 404);
    }
    realtime.emit({ type: 'appointment.cancelled', data: detail });
    return detail;
  };

  return {
    list,
    create,
    cancel,
    getById,
  };
};

export type AppointmentService = ReturnType<typeof createAppointmentService>;

export const appointmentService = createAppointmentService();
