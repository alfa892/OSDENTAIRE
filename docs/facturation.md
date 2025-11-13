# Module Facturation & Assurances (AGENT_ID: A103)
- **agent_id**: A103
- **datetime_utc**: 2025-11-13T13:29:17Z
- **pourquoi**: Offrir une chaine complete de facturation (TVA 20 %, paiements patient/mutuelle, PDF RGPD) pour que le cabinet suive ses honoraires sans quitter l'app OSdentaire.
- **comment**: Drizzle/PostgreSQL pour `invoices`, `invoice_items`, `payments`, `payers`, `insurance_claims`, service Express type (PDFKit + S3 + Postmark), endpoints securises praticien/admin, UI Next.js 16 (listing, creation, modal paiement) et scripts Render (seed, reminders, healthcheck PDF).

## Ce qui a ete livre
- **Schema & migrations**:
  - Nouveaux enums (`invoice_status`, `payer_type`, `payment_source`, `insurance_claim_status`).
  - Tables `payers`, `invoices` (totaux HT/TVA/TTC, `pdf_storage_key`, `paid_amount_cents`, `due_date`, `issued_at`, `paid_at`), `invoice_items`, `payments`, `insurance_claims` + index et relations.
  - Migration SQL `apps/api/drizzle/0003_invoices.sql` + base PGlite adaptee.
- **Service facture (`invoiceService`)**:
  - Creation draft ou issueNow, generation PDF (PDFKit) → upload S3 (`INVOICE_PDF_BUCKET`) et URL signee (TTL config), envoi mail Postmark (`POSTMARK_API_KEY/POSTMARK_FROM_EMAIL`).
  - Ajout d’items, recalcul totaux/TVA, regeneration PDF si facture deja emise.
  - Enregistrement paiements patient/mutuelle (`POST /payments`) → mise a jour statut `paid`, recus mail.
  - Listing filtre, lecture detaillee (items, paiements, claims, pdfUrl), cache des URLs signees, tolerance quand S3 indispo.
- **API Express**:
  - Nouvelles routes `GET/POST /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/items`, `POST /api/invoices/:id/payments` (RBAC praticien/admin, validation Zod, erreurs structurees, injection service).
  - OpenAPI `docs/openapi.yaml` enrichi (schemas Invoice*, requetes, reponses) + doc d’erreurs.
- **Scripts & deploiement**:
  - `npm run invoices:seed` (seed de 3 factures demos), `npm run invoices:remind` (relance email Postmark des factures emises en retard), `npm run invoices:healthcheck` (verif PDF signe).
  - `render.yaml` : preDeploy → `npm run invoices:seed`, nouveaux jobs cron `invoices-remind`, `invoices-pdf-healthcheck`, variables `INVOICE_PDF_BUCKET`, `TVA_RATE`, `POSTMARK_API_KEY`, `POSTMARK_FROM_EMAIL`.
- **Frontend Next.js `/facturation`**:
  - Liste filtrable (all/draft/issued/paid) avec badge statut, solde, liens PDF.
  - Drawer detail (patient, payeur, items, paiements, CTA PDF).
  - Modale creation (patient, description, montant, echeance, issueNow) et modale paiement (montant, methode, source patient/mutuelle/assureur).
  - Boutons d’acces depuis la home.
- **Tests**: Vitest service (`tests/invoiceService.test.ts`) + routes (`tests/invoices.routes.test.ts`) couvrant flux creation, items, paiements, RBAC.

## Rappels d’exploitation
- **Env obligatoires** (API): `INVOICE_PDF_BUCKET`, `TVA_RATE` (ex `0.2`), `POSTMARK_API_KEY`, `POSTMARK_FROM_EMAIL`, `AWS_REGION` + `DATABASE_URL`.
- **Commandes utiles**:
  - `npm run invoices:seed`
  - `npm run invoices:remind`
  - `npm run invoices:healthcheck`
- **RBAC**: seuls praticiens/admins peuvent CRUD les factures/paiements.
- **RGPD**: PDF signe stocke S3, URL courte duree, metadonnees payeurs/paiements isolees dans `payers` et `payments`.

## Wireframe synthetique
```
┌────────────── Factures ──────────────┬────── Detail ──────┐
| REF  Patient     Payeur  Statut Solde| Facture INV-001    |
| INV-001  C. Moreau Mutuelle Issued 80| Patient / Payeur   |
| INV-002  J. Martin Patient Paid  0   | Totaux + Solde     |
| ...                                  | Items + Paiements  |
└──────────────────────────────────────┴────────────────────┘
Modales: [Nouvelle facture] / [Enregistrer paiement]
```
