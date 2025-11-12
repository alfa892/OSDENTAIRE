import cors from 'cors';
import express from 'express';
import { config } from './config';
import { registerPatientRoutes } from './routes/patients';

export const createServer = () => {
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
  registerPatientRoutes(apiRouter);
  app.use('/api', apiRouter);

  return app;
};

export type AppServer = ReturnType<typeof createServer>;
