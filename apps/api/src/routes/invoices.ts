import type { Router } from 'express';
import { ZodError } from 'zod';
import { requireRole } from '../middleware/auth';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  invoiceIdParamSchema,
  addInvoiceItemsSchema,
  addPaymentSchema,
} from '../validation/invoices';
import { createInvoiceService, type InvoiceService, InvoiceError } from '../services/invoiceService';

const buildValidationError = (error: ZodError) => ({
  message: 'validation_failed',
  issues: error.flatten(),
});

export type InvoiceRouteDeps = {
  invoiceService?: InvoiceService;
};

export const registerInvoiceRoutes = (router: Router, deps: InvoiceRouteDeps = {}) => {
  const service = deps.invoiceService ?? createInvoiceService();

  router.get(
    '/invoices',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        listInvoicesQuerySchema.parse(req.query);
        const result = await service.list(req.query);
        res.json(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        console.error('GET /invoices failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.post(
    '/invoices',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        const payload = createInvoiceSchema.parse(req.body);
        const created = await service.create(payload);
        if (!created) {
          return res.status(500).json({ error: 'invoice_creation_failed' });
        }
        res.status(201).json({ data: created });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof InvoiceError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('POST /invoices failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.get(
    '/invoices/:id',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        const params = invoiceIdParamSchema.parse(req.params);
        const invoice = await service.getById(params.id);
        if (!invoice) {
          return res.status(404).json({ error: 'invoice_not_found' });
        }
        return res.json({ data: invoice });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        console.error('GET /invoices/:id failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.post(
    '/invoices/:id/items',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        const params = invoiceIdParamSchema.parse(req.params);
        const body = addInvoiceItemsSchema.parse(req.body);
        const updated = await service.addItems(params.id, body);
        if (!updated) {
          return res.status(500).json({ error: 'invoice_update_failed' });
        }
        res.status(201).json({ data: updated });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof InvoiceError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('POST /invoices/:id/items failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );

  router.post(
    '/invoices/:id/payments',
    requireRole(['practitioner', 'admin']),
    async (req, res) => {
      try {
        const params = invoiceIdParamSchema.parse(req.params);
        const body = addPaymentSchema.parse(req.body);
        const updated = await service.addPayment(params.id, body);
        if (!updated) {
          return res.status(500).json({ error: 'invoice_update_failed' });
        }
        res.status(201).json({ data: updated });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(422).json(buildValidationError(error));
        }
        if (error instanceof InvoiceError) {
          return res.status(error.status).json({ error: error.code });
        }
        console.error('POST /invoices/:id/payments failed', error);
        return res.status(500).json({ error: 'unexpected_error' });
      }
    }
  );
};
