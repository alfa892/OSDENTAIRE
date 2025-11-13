# Module RDV & agenda (AGENT_ID: A102)
- **agent_id**: A102
- **datetime_utc**: 2025-11-13T14:32:00Z
- **pourquoi**: Offrir une gestion centralisée des rendez-vous (hebdo, praticiens, salles) avec notifications internes afin de supprimer les doubles-bookings et synchroniser l'équipe en temps réel.
- **comment**: Schéma Postgres avec `providers`, `rooms`, `appointments`, `appointment_notes` (Drizzle), service + routes Express (`GET/POST /api/appointments`, `PATCH /api/appointments/:id/cancel`, canal `/api/appointments/updates`), front Next.js (vue colonne par praticien, formulaire, polling) et scripts Render (seed + refresh dispos). RBAC conservé (`x-user-role`) + variable `APPOINTMENTS_SLOT_MINUTES` pour aligner les créneaux Europe/Paris.

## Livrables principaux
- **Base de données**: enums (`provider_role`, `appointment_status`, `appointment_note_type`), doublons interdits via service, champs `next_available_at` recalculés (script `agenda:refresh`). Migration SQL `apps/api/drizzle/0002_appointments.sql` + test DB mis à jour.
- **API Express**:
  - Service `appointmentService` (Drizzle + Luxon) : validation des slots, double-booking provider/salle, notifications auto (`appointment_notes`), conversion fuseau Europe/Paris, retour `providers/rooms/meta` avec curseur.
  - Routes sécurisées + canal de polling longue durée (`GET /api/appointments/updates`) basé sur un broker mémoire (`AppointmentRealtime`).
  - Nouveau script `appointments:seed` (2 praticiens, 2 salles, semaine complète) + job `agenda:refresh` pour Render.
- **Frontend Next.js**: page `/agenda` (client component) avec colonnes praticien x jours ouvrés, contrôles semaine +/-1, formulaire de création (patient/praticien/salle/date/heure/durée), bouton d'annulation (RBAC), légende salles, poller des updates (cursor) pour afficher les créations/annulations en quasi temps réel. CTA ajouté sur la home.
- **Documentation & déploiement**:
  - `docs/openapi.yaml` enrichi (schémas Appointment/Provider/Room/Event, endpoints RDV + canal updates).
  - Nouveau fichier `docs/rdv.md` (ce document), README complété (scripts, endpoints, env `APPOINTMENTS_SLOT_MINUTES`).
  - `render.yaml` met `APPOINTMENTS_SLOT_MINUTES`, lance `appointments:seed` en predeploy et crée un job cron `agenda-refresh`.
- **Tests**: Vitest service + routes (double-booking, RBAC cancel, polling). Couverture > 85% maintenue.
