# Architecture cible OSdentaire

## Vue d'ensemble
```
[Next.js 16 Front (apps/web)] --HTTPS--> [API Gateway (Express 5 / apps/api)] --SQL--> [PostgreSQL 15]
                                                     |--S3 (imagerie)
                                                     |--Render Cron (jobs rappels)
                                                     |--Twilio/Postmark (SMS/Email)
```
- Monorepo unique (web+api) orchestré par npm workspaces; chaque module exposé via Express routers, services TypeScript et schéma partagé (Prisma/Drizzle TBD au backlog P0).
- AuthN/AuthZ gérée dans l'API (JWT ou session) avec RBAC (assistante, praticien, admin). Middleware commun injecte `req.user` + vérifie scopes.
- PostgreSQL contient toutes les entités métiers; migrations versionnées (`/apps/api/prisma/migrations` ou `/db/migrations`).
- Stockage d'imagerie déporté sur bucket S3-compatible, seules métadonnées sont en base.

## Modules & services
| Module | Description | Principales tables | Endpoints / flux |
| --- | --- | --- | --- |
| **Utilisateurs & rôles** | Auth, RBAC, audit log | `users`, `roles`, `user_roles`, `sessions`, `audit_logs` | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, middleware `requireRole()` |
| **Patients** | Dossier patient, coordonnées, consentements | `patients`, `patient_contacts`, `consent_forms` | `GET/POST /patients`, `GET /patients/:id`, `DELETE /patients/:id` (droit à l'oubli), export CSV |
| **RDV / Agenda** | Gestion des slots, salles, praticiens | `appointments`, `providers`, `rooms`, `appointment_notes` | `GET /appointments?date=`, `POST /appointments`, `PATCH /appointments/:id/cancel`, notifications websockets |
| **Facturation & Assurances** | Factures, paiements, mutuelles | `invoices`, `invoice_items`, `payments`, `payers` | `POST /invoices`, `POST /invoices/:id/payments`, `GET /insurers` |
| **Dossiers médicaux** | Notes clinique, prescriptions, uploads | `medical_records`, `treatments`, `prescriptions` | `GET /patients/:id/records`, `POST /patients/:id/records` |
| **Imagerie** | Radiographies, scans | `studies`, `images`, `image_tags` (métadonnées) + stockage S3 | `POST /patients/:id/images` (signed URL), `GET /patients/:id/images` |
| **Inventaire** | Stocks matériels, consommables | `inventory_items`, `stock_movements`, `suppliers` | `GET /inventory`, `POST /inventory/movements` |
| **Rappels / Notifications** | SMS/email automatiques | `notification_templates`, `notification_jobs`, `notification_logs` | `POST /notifications/test`, cron `render.yaml` hitting `/jobs/notifications/dispatch` |
| **Tableau de bord** | KPIs journaliers/semaine | vues matérialisées `vw_pipeline_metrics`, `vw_revenue_daily` | `GET /dashboard/overview` |

## Flux fonctionnels clés
1. **Patient onboarding**: Front → `POST /patients` (RBAC assistante). API crée patient, consentements, audit log. Trigger envoi email bienvenue via notifications.
2. **Prise de RDV**: UI agenda interroge `GET /appointments?from=...&to=...`. Création via `POST /appointments` (assistante/praticien). Vérification double-booking et règles salle.
3. **Facturation/Assurances**: Après rendez-vous, `POST /invoices` (praticien/admin). Items liés au traitement, TVA 20%. Paiement part mutuelle/patient via `POST /invoices/:id/payments`. Génère PDF (stockage S3) et envoie par email.
4. **Dossiers médicaux**: Praticien consigne notes: `POST /patients/:id/records`. Champs sensibles chiffrés applicativement (AES). Historique accessible selon rôle.
5. **Imagerie**: Upload radiographie → front demande URL signée (`POST /patients/:id/images/upload-url`), charge fichier S3, notifie API pour métadonnées.
6. **Inventaire**: Réception stock `POST /inventory/movements` (type `IN`). Décrément auto lors d'actes. Alertes bas niveau via module notifications.
7. **Rappels**: Cron Render appelle `/jobs/notifications/dispatch`. Service lit `notification_jobs` (SMS/Email) et envoie via Twilio/Postmark. Statut stocké, audit log.
8. **Dashboard**: Front appelle `GET /dashboard/overview` qui lit vues SQL agrégées (RDV du jour, revenus, pipeline marketing, rappels envoyés).

## Sécurité & conformité
- **Auth**: JWT courts + refresh, stockage httpOnly. MFA optionnel (backlog P1).
- **RBAC**: middleware `requireRole(['assistant','practitioner','admin'])` par route.
- **Audit log**: toute mutation écrit dans `audit_logs` (timestamp, user_id, action, payload hash).
- **RGPD**: tables marquées `deleted_at`; script `npm run dpa:export` pour droit à l'oubli (anonymisation). DPA doc dans `/docs/compliance/` (à produire).
- **Chiffrement**: TLS via Render. Données sensibles (notes médicales, imagerie metadata) chiffrées au repos avec clé `APP_KMS_KEY`. Secrets gérés via Render env vars.

## Observabilité
- Logging JSON (pino) avec corrélation `request_id`.
- Metrics simples via `/healthz` + `/metrics` (Prometheus format) pour latence, erreurs, jobs.
- Alertes Render (healthcheck) + Sentry (front+back) pour erreurs runtime.

## Déploiement
- Docker multi-stage pour API (build TS → dist) + Next.js front (standalone). Render services séparés.
- `render.yaml` décrira services: `web` (Next) + `api` (Docker) + `cron` (notifications) + `postgres` (managed).
- Scripts npm: `npm run migrate:deploy`, `npm run seed:dev`, `npm run lint`, `npm run test`.
- Healthchecks: `/healthz` (API), `/_health` (Next). Migrations exécutées avant `npm start`.
