import 'dotenv/config';
import { and, eq, lt } from 'drizzle-orm';
import { db, dbPool } from '../db/client';
import { invoices, payers } from '../db/schema';
import { createInvoiceMailer } from '../services/invoiceMailer';

(async () => {
  const now = new Date();
  const overdue = await db
    .select({
      id: invoices.id,
      reference: invoices.reference,
      amount: invoices.totalInclTaxCents,
      payerEmail: payers.email,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .innerJoin(payers, eq(payers.id, invoices.payerId))
    .where(and(eq(invoices.status, 'issued'), lt(invoices.dueDate, now)));

  const mailer = createInvoiceMailer();
  let sent = 0;
  for (const invoice of overdue) {
    await mailer.sendReminder({
      reference: invoice.reference,
      amountCents: invoice.amount ?? 0,
      email: invoice.payerEmail ?? null,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
    });
    sent += invoice.payerEmail ? 1 : 0;
  }

  console.log(`Invoice reminders sent: ${sent}/${overdue.length}`);
})()
  .catch((error) => {
    console.error('Invoice reminder job failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
