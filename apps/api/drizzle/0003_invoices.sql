DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payer_type') THEN
        CREATE TYPE payer_type AS ENUM ('patient', 'mutuelle', 'insurance', 'third_party');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_source') THEN
        CREATE TYPE payment_source AS ENUM ('patient', 'mutuelle', 'insurance', 'other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_claim_status') THEN
        CREATE TYPE insurance_claim_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS payers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    type payer_type NOT NULL DEFAULT 'patient',
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    postal_code TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payers_type_idx ON payers(type);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE RESTRICT,
    status invoice_status NOT NULL DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'EUR',
    total_excl_tax_cents INTEGER NOT NULL DEFAULT 0,
    total_tax_cents INTEGER NOT NULL DEFAULT 0,
    total_incl_tax_cents INTEGER NOT NULL DEFAULT 0,
    paid_amount_cents INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ NOT NULL,
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    pdf_storage_key TEXT,
    pdf_signed_url TEXT,
    pdf_signed_url_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_patient_idx ON invoices(patient_id);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    tax_rate_bps INTEGER NOT NULL DEFAULT 2000,
    total_excl_tax_cents INTEGER NOT NULL DEFAULT 0,
    total_tax_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE RESTRICT,
    source payment_source NOT NULL DEFAULT 'patient',
    method TEXT NOT NULL DEFAULT 'card',
    amount_cents INTEGER NOT NULL,
    notes TEXT,
    reference TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments(invoice_id);

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES payers(id) ON DELETE RESTRICT,
    status insurance_claim_status NOT NULL DEFAULT 'draft',
    claim_number TEXT,
    coverage_percent INTEGER NOT NULL DEFAULT 0,
    covered_amount_cents INTEGER NOT NULL DEFAULT 0,
    filed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_claims_invoice_idx ON insurance_claims(invoice_id);
