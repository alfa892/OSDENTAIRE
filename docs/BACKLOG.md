# Backlog initial

| ID | User story | Critères d'acceptation | Estim (pts) | Priorité |
| --- | --- | --- | --- | --- |
| P0-SEC-01 | En tant qu'admin je peux créer des utilisateurs et leur attribuer un rôle (assistante, praticien, admin). | REST `POST /users`, `PATCH /users/:id/role`, RBAC vérifié en tests, audit log écrit, secrets hashés (argon2). | 8 | P0 |
| P0-SEC-02 | En tant qu'utilisateur je peux me connecter via email+MFA optionnel pour accéder au cockpit. | `POST /auth/login`, refresh tokens, MFA togglable, sessions stockées en DB, tests intégration. | 13 | P0 |
| P0-PAT-01 | En tant qu'assistante je crée un patient avec coordonnées et consentements. | `POST /patients`, validations Zod, enregistrement PostgreSQL, audit log, droit à l'oubli (soft delete + anonymisation script). | 8 | P0 |
| P0-RDV-01 | En tant qu'assistante je planifie un rendez-vous sans double-booking. | `POST /appointments`, vérifie praticien/salle libres, crée notification rappel, tests unitaires. | 13 | P0 |
| P0-RDV-02 | En tant que praticien je vois l'agenda du jour. | `GET /appointments?date=`, filtre par rôle, front affiche timeline. | 5 | P0 |
| P0-FAC-01 | En tant que praticien je génère une facture pour un traitement. | `POST /invoices` + items, TVA 20%, PDF généré et stocké, OpenAPI mis à jour. | 13 | P0 |
| P0-FAC-02 | En tant qu'assistante je marque un paiement partiel (patient/mutuelle). | `POST /invoices/:id/payments`, validation montants, soldes mis à jour. | 5 | P0 |
| P0-RAP-01 | En tant que patient je reçois un SMS/email de rappel 24h avant RDV. | Scheduler Render, job lit `notification_jobs`, logs statut, idempotence, monitoring basique. | 8 | P0 |
| P0-DOS-01 | En tant que praticien je saisis un dossier médical sécurisé. | `POST /patients/:id/records`, champs chiffrés, RBAC (assistante read-only), audit trail. | 13 | P0 |
| P0-INV-01 | En tant que gestionnaire je suis alerté quand un consommable passe sous seuil. | Batch qui calcule seuil, `notifications` déclenchées, page inventaire montre badges. | 8 | P0 |
| P1-IMG-01 | En tant que praticien je dépose une radio liée au patient. | Signed URL S3, métadonnées stockées, preview dans UI, RGPD consent. | 8 | P1 |
| P1-DASH-01 | En tant qu'admin je vois les KPIs (RDV, CA, pipeline). | `GET /dashboard/overview`, vues SQL, graphiques front. | 8 | P1 |
| P1-EXP-01 | En tant qu'admin j'exporte patients et factures au format CSV/ZIP. | Endpoint async, stockage temporaire S3, expiration 24h. | 8 | P1 |
| P1-PARAM-01 | En tant qu'admin je configure horaires cabinet, TVA, prestataires. | CRUD `settings` table, validations, propagation sur modules RDV/facturation. | 5 | P1 |
| P1-TPL-01 | En tant que praticien je personnalise les templates de devis/factures. | Editeur Markdown, placeholders, preview PDF. | 8 | P1 |
| P1-ROLE-01 | En tant qu'admin je gère des permissions fines (scopes). | Table `permissions`, UI mapping rôle→permission, middleware mis à jour. | 13 | P1 |
| P2-ANLT-01 | En tant que direction je consulte un tableau de bord historique (annuel). | Data warehouse léger (materialized views), graphiques multi-séries. | 13 | P2 |
| P2-API-01 | En tant qu'intégrateur je consomme une API publique sécurisée. | OAuth client credentials, rate limiting, doc publique. | 20 | P2 |
| P2-INT-01 | En tant que logisticien j'importe un inventaire depuis CSV fournisseur. | Upload, parsing, validation, rollback en cas d'erreur, logs. | 8 | P2 |
