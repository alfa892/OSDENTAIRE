# CHANGELOG

Format obligatoire pour chaque entrée :
- 2025-11-12T14:07Z | agent_id=A123 | module=RDV | portée=API+DB
  fichiers=[api/appointments.ts, db/migrations/20251112_init.sql]
  endpoints=[POST /appointments, GET /appointments/:id]
  tests=[appointments.spec.ts]
  décision="créneaux de 5 min; double-booking interdit"

Entrées réelles à ajouter ci-dessous par ordre chronologique (plus récent en haut).

<!-- INSERT NEW CHANGELOG ITEMS ABOVE THIS LINE -->
- 2025-11-13T14:45:12Z | agent_id=A102 | module=RDV & Agenda | portée=API+DB+UI
  fichiers=[apps/api/src/services/appointmentService.ts,apps/api/src/routes/appointments.ts,apps/api/drizzle/0002_appointments.sql,apps/web/src/app/agenda/agendaModule.tsx,apps/api/src/scripts/seedAppointments.ts,render.yaml]
  endpoints=[GET /api/appointments,POST /api/appointments,PATCH /api/appointments/:id/cancel,GET /api/appointments/updates]
  tests=[tests/appointmentService.test.ts,tests/appointments.routes.test.ts]
  décision="Slots 15min Europe/Paris, long polling interne, seed praticiens/salles + job Render"
- 2025-11-13T11:12:32Z | agent_id=A101 | module=Patients | portée=API+DB+UI
  fichiers=[apps/api/src/services/patientService.ts,apps/api/src/routes/patients.ts,apps/api/drizzle/0001_patients.sql,apps/web/src/app/patients/patientsModule.tsx]
  endpoints=[GET /api/patients,POST /api/patients,GET /api/patients/:id,DELETE /api/patients/:id]
  tests=[tests/patientService.test.ts,tests/patients.routes.test.ts,tests/auth.middleware.test.ts]
  décision="Drizzle/Postgres pour patients, script d'anonymisation, RBAC par entête, UI Next.js (table + drawer)"
