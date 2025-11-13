import cors from 'cors';
import express from 'express';
import { config } from './config';
import { authenticate } from './middleware/auth';
import { registerPatientRoutes } from './routes/patients';
import { registerAppointmentRoutes } from './routes/appointments';
import { createPatientService, type PatientService } from './services/patientService';
import { createAppointmentService, type AppointmentService } from './services/appointmentService';
import { appointmentRealtime, type AppointmentRealtime } from './services/appointmentRealtime';
import type { Database } from './db/client';

export type ServerDependencies = {
  patientService?: PatientService;
  appointmentService?: AppointmentService;
  realtime?: AppointmentRealtime;
  db?: Database;
};

export const createServer = (deps: ServerDependencies = {}) => {
  const app = express();

  const corsOrigins =
    config.corsOrigin === '*'
      ? undefined
      : config.corsOrigin.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: corsOrigins ?? '*',
    })
  );

  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const apiRouter = express.Router();
  apiRouter.use(authenticate);
  const patientSvc = deps.patientService ?? (deps.db ? createPatientService(deps.db) : createPatientService());
  const realtime = deps.realtime ?? appointmentRealtime;
  const appointmentSvc =
    deps.appointmentService ?? (deps.db ? createAppointmentService(deps.db, realtime) : createAppointmentService(undefined, realtime));

  registerPatientRoutes(apiRouter, { patientService: patientSvc });
  registerAppointmentRoutes(apiRouter, { appointmentService: appointmentSvc, realtime });
  app.use('/api', apiRouter);

  return app;
};

export type AppServer = ReturnType<typeof createServer>;
