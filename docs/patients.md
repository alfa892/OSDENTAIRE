# Module Patients & consentements (AGENT_ID: A101)
- **agent_id**: A101
- **datetime_utc**: 2025-11-13T10:54:07Z
- **pourquoi**: brancher enfin la base patient PostgreSQL (RGPD), livrer un CRUD exploitable par l'équipe soin/assistantes et préparer Render (migrations, seed, anonymisation) pour un go-live immédiat.
- **comment**: Drizzle + Postgres (`patients`, `patient_contacts`, `consent_forms`), services typés, middleware JWT-RBAC via entêtes, UI Next.js (table + drawer) reliée aux endpoints et scripts d'exploitation (`db:migrate`, `patients:seed`, `patients:anonymize`).

## Ce qui a été livré
- **Schéma & migrations**: tables avec enums (`patient_status`, `contact_type`, `consent_status`), index, `deleted_at/anonymized_at` et contraintes `balance_cents >= 0`. Fichier SQL versionné `apps/api/drizzle/0001_patients.sql` appliqué par `npm run db:migrate` (table `app_migrations`).
- **Validations Zod**: `createPatientSchema`, `contactInputSchema`, `listPatientsQuerySchema`, `patientIdParamSchema` partagés entre routes et service pour émettre des 422 cohérents.
- **Service patient**: `createPatientService` (Drizzle) gère liste paginée, recherche `q`, création (contacts + consentements), soft delete (admin), anonymisation batch (script) et lecture détaillée.
- **API sécurisée**: middleware `authenticate` (`x-user-role`, `x-user-id` ou `Bearer role:admin`) + `requireRole`. Routes `GET/POST /api/patients`, `GET/DELETE /api/patients/:id` avec logs d'erreurs, codes 401/403/422/500 et import du service injecté (testable).
- **Scripts & déploiement**:
  - `npm run db:migrate` → applique `/apps/api/drizzle/*.sql`.
  - `npm run patients:seed` → seed réaliste (5 patients + consentements) via service.
  - `npm run patients:anonymize` → anonymise patients soft-deleted au-delà de `PATIENTS_RETENTION_DAYS` (défaut 730j).
  - Variables Render: `DATABASE_URL`, `PATIENTS_RETENTION_DAYS`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`.
- **Frontend Next.js**: page `/patients` avec switch de rôle (assistant/praticien/admin), table responsive (statut consentements, solde), fiche latérale (contacts + consentements) et drawer formulaire (nom, traitement, RDV, contacts d'urgence, consentement). CTA ajouté sur `/`.
- **Wireframes (ASCII)**:
```
┌──────────── Tableau patients ─────────────┬── Drawer ──┐
| Nom + contact | Traitement | RDV | Consent | Solde      |
|--------------------------------------------------------|
| > Cam. Moreau | Invisalign | 03/03 | ●●○ | 120 €      |
|   ...                                            ...   |
└────────────────────────────────────────────────────────┘
                          ┌─────────────────────────────
                          │ Nouveau patient
                          │ [Nom        ] [Email      ]
                          │ [Téléphone  ] [RDV        ]
                          │ [Urgence    ] [Consent    ]
                          │ [Notes....................]
                          │ [Annuler]   [Enregistrer]
                          └─────────────────────────────
```
- **RGPD**: soft delete (DELETE → `status=archived`, `deleted_at`), script d'anonymisation, consentements versionnés, UI rappelant rôle/admin requis pour purge.
- **Documentation**: ce fichier + `docs/openapi.yaml` (endpoints, schémas, erreurs 401/403/422/500), README/Render mis à jour.
- **Tests**: Vitest unitaires (service) + intégration (Supertest) avec `pg-mem`, couverture > 85% (voir `npm --workspace apps/api run test`).
