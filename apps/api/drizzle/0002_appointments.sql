DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_role') THEN
        CREATE TYPE provider_role AS ENUM ('dentist','orthodontist','hygienist');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('scheduled','cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_note_type') THEN
        CREATE TYPE appointment_note_type AS ENUM ('note','notification');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE UNIQUE INDEX IF NOT EXISTS providers_full_name_idx ON providers(full_name);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    floor TEXT,
    equipment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_idx ON rooms(name);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS appointments_provider_idx ON appointments(provider_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_room_idx ON appointments(room_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments(status);
CREATE INDEX IF NOT EXISTS appointments_start_idx ON appointments(start_at);

CREATE TABLE IF NOT EXISTS appointment_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    author_role TEXT NOT NULL,
    author_name TEXT NOT NULL,
    kind appointment_note_type NOT NULL DEFAULT 'note',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_notes_appointment_idx ON appointment_notes(appointment_id);
