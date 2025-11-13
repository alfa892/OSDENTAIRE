# Readiness & Gap Analysis

## Stack actuelle
- **Monorepo npm** avec workspaces `apps/web` (Next.js 16, React 19, Tailwind v4) et `apps/api` (Express 5, TypeScript, Vitest).
- **Persistances**: aucune base branchée; patients servis depuis un mock in-memory.
- **Infra cible fournie**: Render (API+Front) + PostgreSQL géré.

## Dépendances clés
- Backend: `express`, `cors`, `dotenv`, `zod`, `ts-node-dev`, `vitest`.
- Frontend: `next`, `react`, `tailwindcss`, `eslint`.
- Aucun ORM ni client PostgreSQL pour l'instant.

## Qualité & outillage
- Tests: Vitest (service patients) seulement; pas de tests intégration/API.
- Lint/Typecheck: `tsc --noEmit` côté API, ESLint+TSC côté web.
- Pas d'OpenAPI ni de monitoring.
- Pas de CI configurée.

## Sécurité & conformité
- Pas d'authentification, RBAC ni audit log.
- Pas de gestion des secrets (juste `.env` local).
- Pas de mentions RGPD (DPA, droit à l'oubli, minimisation), ni chiffrement at-rest (dépendra de PostgreSQL) ou TLS (fourni par Render mais non documenté).

## Déploiement actuel
- README indique commandes `npm run dev:*`, `npm run build:*`.
- Aucun `Dockerfile`, `Procfile`, scripts de migration, ni seeding.
- Pas de configuration Render spécifique (env vars, healthchecks) ni de scripts pour `npm install --workspace`.

## Gaps critiques (à couvrir P0)
1. **Sécurité / Auth**: introduire gestion des utilisateurs, rôles (assistante, praticien, admin), RBAC API/UI, audit log centralisé.
2. **Persistance**: modélisation PostgreSQL (patients, rendez-vous, facturation, etc.), migrations versionnées, seed dev.
3. **Observabilité & conformité**: monitoring (logs structurés, métriques simples), dossiers RGPD (registre traitements, DPA), procédures droit à l'oubli.
4. **Docs / Traçabilité**: OpenAPI, CHANGELOG, docs par module.
5. **Déploiement Render**: Dockerfile(s) ou propre `render.yaml`, scripts migration (Prisma/Drizzle), healthchecks et variables d'env.

## Risques
- **Scope creep**: nombreuses fonctionnalités (imagerie, inventaire, facturation). Nécessite découpage par modules & prompts multi-agents.
- **Données sensibles**: nécessité d'ANSSI/RGPD; décider stockage chiffré (pgcrypto / KMS) → option retenue: PostgreSQL géré + chiffrement applicatif pour champs critiques (ex: données médicales). Ajouté au backlog.
- **Internationalisation**: cible fr-FR ; s'assurer timezone Europe/Paris, monnaie EUR, TVA.
- **Disponibilité**: Render single region; prévoir plan de sauvegarde (snapshots PG) et readiness check.

## Informations manquantes & décisions
1. **Identité fournisseur SMS/Email**: non spécifié. Choix P0: utiliser services webhook-friendly Twilio (SMS) et Postmark (Email) pour rapidité; à documenter pour remplacement éventuel (voir backlog).
2. **Stockage imagerie**: aucune info. Décision: stocker métadonnées en PostgreSQL + fichiers sur S3-compatible (Render supporte Backblaze/S3). Placeholder module.
3. **Facturation/Assurances**: pas de règles détaillées. On adopte TVA 20%, factures PDF générées via service interne, support mutuelles via champ `payer`. Ajuster plus tard.

Ces hypothèses sont explicitement documentées ici et seront revalidées avec le client.
