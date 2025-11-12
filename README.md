# OSdentaire · minimaquette full-stack

Maquette de départ pour piloter un cabinet dentaire de A à Z :

- **Frontend** (`apps/web`) : Next.js 16 + App Router + Tailwind v4, prêt pour un déploiement Vercel.
- **Backend** (`apps/api`) : Express 5 + TypeScript, données fictives en mémoire et validations Zod.
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
- `GET /api/patients` (liste fictive)
- `POST /api/patients` (ajoute un patient en mémoire, validé par Zod)

Variables d'environnement utiles (`apps/api/.env`) :

```
API_PORT=5050
CORS_ORIGIN=http://localhost:3000
```

### Frontend Next.js

```bash
npm run dev:web
```

Définis `NEXT_PUBLIC_API_URL` (dans `apps/web/.env.local`) pour pointer vers ton API locale ou distante :

```
NEXT_PUBLIC_API_URL=http://localhost:5050
```

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
- Créer des modules dédiés (agenda, facturation, marketing) en feature flags.

Bon build !
