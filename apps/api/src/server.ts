import cors from 'cors';
import express from 'express';
import { config } from './config';
import { authenticate } from './middleware/auth';
import { registerPatientRoutes } from './routes/patients';
import { registerAppointmentRoutes } from './routes/appointments';
import { registerInvoiceRoutes } from './routes/invoices';
import { createPatientService, type PatientService } from './services/patientService';
import { createAppointmentService, type AppointmentService } from './services/appointmentService';
import { appointmentRealtime, type AppointmentRealtimeInstance } from './services/appointmentRealtime';
import { createInvoiceService, type InvoiceService } from './services/invoiceService';
import type { Database } from './db/client';

export type ServerDependencies = {
  patientService?: PatientService;
  appointmentService?: AppointmentService;
  invoiceService?: InvoiceService;
  realtime?: AppointmentRealtimeInstance;
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
  const invoiceSvc = deps.invoiceService ?? (deps.db ? createInvoiceService(deps.db) : createInvoiceService());

  registerPatientRoutes(apiRouter, { patientService: patientSvc });
  registerAppointmentRoutes(apiRouter, { appointmentService: appointmentSvc, realtime });
  registerInvoiceRoutes(apiRouter, { invoiceService: invoiceSvc });
  app.use('/api', apiRouter);

  return app;
};

export type AppServer = ReturnType<typeof createServer>;
