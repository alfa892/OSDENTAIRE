# OSdentaire · minimaquette full-stack

Maquette de départ pour piloter un cabinet dentaire de A à Z :

- **Frontend** (`apps/web`) : Next.js 16 + App Router + Tailwind v4, prêt pour un déploiement Vercel.
- **Backend** (`apps/api`) : Express 5 + TypeScript + Drizzle (PostgreSQL) avec validations Zod et RBAC par entête.
- **Tests** : Vitest côté API et ESLint/TypeScript côté web pour garantir la qualité minimale.

## Structure

```
apps/
  api/   -> serveur Express + Vitest
  web/   -> interface Next.js + Tailwind
package.json (workspaces npm)
tsconfig.base.json
```

## Prérequis

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
```

## Démarrage local

### API Express

```bash
npm run dev:api
```

Endpoints inclus :

- `GET /healthz` (ping de l'API)
- `GET /api/patients` (liste paginée + recherche, RBAC assistant/praticien/admin)
- `POST /api/patients` (création via assistants/admin avec validations Zod)
- `GET /api/patients/:id` (fiche détaillée contacts + consentements)
- `DELETE /api/patients/:id` (soft delete admin, anonymisation différée)
- `GET /api/appointments` (agenda hebdo Europe/Paris + providers/salles + curseur realtime)
- `POST /api/appointments` (création créneau, anti double-booking, notification interne)
- `PATCH /api/appointments/:id/cancel` (annulation praticien/admin)
- `GET /api/appointments/updates` (long polling 25s pour synchroniser l'UI)

**Auth locale** : ajouter les entêtes `x-user-role` (`assistant`, `practitioner`, `admin`) et `x-user-id` sur chaque requête API. Un token `Bearer role:admin` est également accepté pour des tests rapides.

Variables d'environnement utiles (`apps/api/.env`) :

```
API_PORT=5050
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/osdentaire
PATIENTS_RETENTION_DAYS=730
APPOINTMENTS_SLOT_MINUTES=15
```

### Frontend Next.js

```bash
npm run dev:web
```

Définis `NEXT_PUBLIC_API_URL` (dans `apps/web/.env.local`) pour pointer vers ton API locale ou distante :

```
NEXT_PUBLIC_API_URL=http://localhost:5050
```

Pages disponibles : `/patients` (liste + drawer) et `/agenda` (vue hebdo colonne par praticien avec formulaire de création, annulation RBAC et polling temps réel).

## Base de données & scripts RGPD

```bash
npm run db:migrate        # applique /apps/api/drizzle/*.sql
npm run patients:seed     # insère 5 patients + consentements de démo
npm run patients:anonymize # anonymise les patients supprimés au-delà de PATIENTS_RETENTION_DAYS
npm run appointments:seed  # installe 2 praticiens + 1 semaine de RDV
npm run agenda:refresh     # recalcule next_available_at pour chaque praticien
```

> Les migrations s'appuient sur Drizzle. Un log `app_migrations` empêche les doubles exécutions. Le seed passe par le service applicatif pour garantir les validations et l'écriture des consentements.

## Tests & qualité

```bash
npm run --workspace apps/api test      # Vitest (services patients)
npm run --workspace apps/api lint      # TypeScript strict
npm run --workspace apps/web lint      # ESLint flat config
npm run --workspace apps/web typecheck # TSC côté frontend
```

## Build production

```bash
npm run build:api
npm run build:web
```

## Déploiement conseillé

1. **GitHub** : push ce repo pour que Vercel détecte la workspace `apps/web` automatiquement.
2. **Frontend (Vercel)** :
   - Root directory : `apps/web`
   - Build command : `npm run build`
   - Output : `.next`
   - Env : `NEXT_PUBLIC_API_URL=https://ton-api.exemple.com`
3. **Backend (Railway/Render/Fly.io/VPS)** : déploie `apps/api`, renseigne `API_PORT` et autorise le domaine Vercel dans `CORS_ORIGIN`.
4. **Test** : `curl $NEXT_PUBLIC_API_URL/healthz` doit répondre `status: ok`.

## Prochaines étapes possibles

- Brancher une base SQL (Prisma + Postgres) ou Supabase pour persister les patients.
- Ajouter l'authentification (Clerk/Auth0) pour l'équipe du cabinet.
- Créer des modules dédiés (agenda avancé, facturation, marketing) en feature flags.
- Brancher des rappels SMS/mail (ou WhatsApp) sur les évènements `appointment.*`.

Bon build !
