import 'dotenv/config';
import { desc, eq } from 'drizzle-orm';
import { db, dbPool } from '../db/client';
import { invoices } from '../db/schema';
import { createInvoiceService } from '../services/invoiceService';

(async () => {
  const [invoice] = await db
    .select({ id: invoices.id, reference: invoices.reference })
    .from(invoices)
    .where(eq(invoices.status, 'issued'))
    .orderBy(desc(invoices.issuedAt))
    .limit(1);

  if (!invoice) {
    console.warn('No issued invoice found to check.');
    return;
  }

  const service = createInvoiceService();
  const detail = await service.getById(invoice.id);
  if (!detail?.pdfUrl) {
    throw new Error('pdf_url_missing');
  }
  console.log(`Invoice PDF reachable for ${detail.reference}: ${detail.pdfUrl}`);
})()
  .catch((error) => {
    console.error('Invoice PDF healthcheck failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
