import type { Router } from 'express';
import { ZodError } from 'zod';
import {
  patientService as defaultPatientService,
  type PatientService,
} from '../services/patientService';
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
} from '../validation/patients';
import { requireRole } from '../middleware/auth';

const buildValidationError = (error: ZodError) => ({
  message: 'validation_failed',
  issues: error.flatten(),
});

export type PatientRouteDeps = {
  patientService?: PatientService;
};

export const registerPatientRoutes = (router: Router, deps: PatientRouteDeps = {}) => {
  const service = deps.patientService ?? defaultPatientService;

  router.get(
    '/patients',
    requireRole(['assistant', 'practitioner', 'admin']),
    async (req, res) => {
      try {
        const queryResult = listPatientsQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
          return res.status(422).json(buildValidationError(queryResult.error));
        }

        const result = await service.list(queryResult.data);
        return res.json({ data: result.data, meta: { total: result.total, limit: result.limit, offset: result.offset } });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        console.error('GET /patients failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.post('/patients', requireRole(['assistant', 'admin']), async (req, res) => {
    try {
      const body = createPatientSchema.parse(req.body);
      const created = await service.create(body);
      return res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json(buildValidationError(error));
      }
      console.error('POST /patients failed', error);
      return res.status(500).json({ error: 'unexpected_error' });
    }
  });

  router.get('/patients/:id', requireRole(['assistant', 'practitioner', 'admin']), async (req, res) => {
    try {
      const paramsResult = patientIdParamSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(422).json(buildValidationError(paramsResult.error));
      }

      const patient = await service.getById(paramsResult.data.id);
      if (!patient) {
        return res.status(404).json({ error: 'patient_not_found' });
      }

      return res.json({ data: patient });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json(buildValidationError(error));
      }
      console.error('GET /patients/:id failed', error);
      return res.status(500).json({ error: 'unexpected_error' });
    }
  });

  router.delete('/patients/:id', requireRole(['admin']), async (req, res) => {
    try {
      const paramsResult = patientIdParamSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(422).json(buildValidationError(paramsResult.error));
      }

      const deleted = await service.softDelete(paramsResult.data.id);
      if (!deleted) {
        return res.status(404).json({ error: 'patient_not_found' });
      }

      return res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json(buildValidationError(error));
      }
      console.error('DELETE /patients/:id failed', error);
      return res.status(500).json({ error: 'unexpected_error' });
    }
  });
};
