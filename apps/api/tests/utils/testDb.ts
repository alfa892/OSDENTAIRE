import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../../src/db/schema';

const BASE_SCHEMA_SQL = `
CREATE TYPE patient_status AS ENUM ('active','archived');
CREATE TYPE contact_type AS ENUM ('phone','email','emergency');
CREATE TYPE consent_status AS ENUM ('pending','signed');
CREATE TYPE provider_role AS ENUM ('dentist','orthodontist','hygienist');
CREATE TYPE appointment_status AS ENUM ('scheduled','cancelled');
CREATE TYPE appointment_note_type AS ENUM ('note','notification');

CREATE TABLE patients (
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    preferred_name TEXT,
    email TEXT,
    phone TEXT,
    active_treatment TEXT,
    status patient_status NOT NULL DEFAULT 'active',
    next_visit TIMESTAMPTZ,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    deleted_at TIMESTAMPTZ,
    anonymized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_contacts (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    type contact_type NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_forms (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    template TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    status consent_status NOT NULL DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE providers (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    initials TEXT NOT NULL,
    specialty TEXT,
    role provider_role NOT NULL DEFAULT 'dentist',
    color TEXT NOT NULL DEFAULT '#0ea5e9',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    default_duration_minutes INTEGER NOT NULL DEFAULT 30,
    next_available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    floor TEXT,
    equipment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    slot_minutes INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    cancel_reason TEXT,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointment_notes (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    author_role TEXT NOT NULL,
    author_name TEXT NOT NULL,
    kind appointment_note_type NOT NULL DEFAULT 'note',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export type TestDatabase = PgliteDatabase<typeof schema>;

export const createTestDb = async () => {
  const pgLite = new PGlite();
  await pgLite.exec(BASE_SCHEMA_SQL);
  const database = drizzle(pgLite, { schema });

  return {
    database,
    close: async () => {
      await pgLite.close();
    },
  };
};
