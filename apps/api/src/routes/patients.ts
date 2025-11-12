import { Router } from 'express';
import { z } from 'zod';
import { patientService, type CreatePatientPayload } from '../services/patientService';

const createPatientSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  activeTreatment: z.string().min(3),
  nextVisit: z.string().datetime({ offset: true }).or(z.string().date()),
  balance: z.coerce.number().nonnegative(),
});

export const registerPatientRoutes = (router: Router) => {
  router.get('/patients', (_req, res) => {
    res.json({ data: patientService.list() });
  });

  router.post('/patients', (req, res) => {
    const parsed = createPatientSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const payload = parsed.data as CreatePatientPayload;
    const newPatient = patientService.create(payload);
    res.status(201).json({ data: newPatient });
  });
};
