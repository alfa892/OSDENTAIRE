import type { Router } from 'express';
import { ZodError } from 'zod';
import { requireRole } from '../middleware/auth';
import {
  appointmentIdParamSchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
} from '../validation/appointments';
import {
  appointmentService as defaultAppointmentService,
  type AppointmentService,
  AppointmentError,
} from '../services/appointmentService';
import { appointmentRealtime, type AppointmentRealtimeInstance } from '../services/appointmentRealtime';

const buildValidationError = (error: ZodError) => ({
  message: 'validation_failed',
  issues: error.flatten(),
});

export type AppointmentRouteDeps = {
  appointmentService?: AppointmentService;
  realtime?: AppointmentRealtimeInstance;
};

export const registerAppointmentRoutes = (router: Router, deps: AppointmentRouteDeps = {}) => {
  const service = deps.appointmentService ?? defaultAppointmentService;
  const realtime = deps.realtime ?? appointmentRealtime;

  router.get(
    '/appointments',
    requireRole(['assistant', 'practitioner', 'admin']),
    async (req, res) => {
      try {
        listAppointmentsQuerySchema.parse(req.query); // surface validation errors early
        const result = await service.list(req.query);
        res.json(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof AppointmentError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('GET /appointments failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.post(
    '/appointments',
    requireRole(['assistant', 'practitioner', 'admin']),
    async (req, res) => {
      try {
        createAppointmentSchema.parse(req.body);
        if (!req.user) {
          return res.status(401).json({ error: 'missing_credentials' });
        }
        const created = await service.create(req.body, req.user);
        res.status(201).json({ data: created });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof AppointmentError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('POST /appointments failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.patch(
    '/appointments/:id/cancel',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        const params = appointmentIdParamSchema.parse(req.params);
        cancelAppointmentSchema.parse(req.body ?? {});
        if (!req.user) {
          return res.status(401).json({ error: 'missing_credentials' });
        }
        const updated = await service.cancel(params.id, req.body ?? {}, req.user);
        res.json({ data: updated });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof AppointmentError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('PATCH /appointments/:id/cancel failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.get(
    '/appointments/updates',
    requireRole(['assistant', 'practitioner', 'admin']),
    (req, res) => {
      const requestedCursor = Number(req.query.cursor ?? 0);
      const cursor = Number.isFinite(requestedCursor) ? requestedCursor : 0;
      res.setHeader('Cache-Control', 'no-store');

      const cleanup = realtime.wait(cursor, (payload) => {
        if (res.writableEnded) return;
        res.json(payload);
      });

      req.on('close', cleanup);
      req.on('error', cleanup);
    }
  );
};
