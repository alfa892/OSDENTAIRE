import 'dotenv/config';
import { db, dbPool } from '../db/client';
import { insuranceClaims, invoiceItems, invoices, payers, payments } from '../db/schema';
import { createInvoiceService } from '../services/invoiceService';
import { createInMemoryInvoiceStorage } from '../services/invoiceStorage';
import { createMemoryMailer } from '../services/invoiceMailer';

(async () => {
  const storage = createInMemoryInvoiceStorage();
  const mailer = createMemoryMailer();
  const invoiceService = createInvoiceService(db, {
    storage,
    mailer,
  });

  await db.delete(invoiceItems);
  await db.delete(payments);
  await db.delete(insuranceClaims);
  await db.delete(invoices);
  await db.delete(payers);

  const patients = await db.query.patients.findMany({ limit: 3 });
  if (patients.length === 0) {
    console.warn('No patients found. Run npm run patients:seed first.');
    return;
  }

  const samples = [
    {
      patientId: patients[0].id,
      dueDate: new Date().toISOString(),
      items: [
        { description: 'Consultation de controle', quantity: 1, unitPrice: 65 },
        { description: 'Detartrage complet', quantity: 1, unitPrice: 120 },
      ],
      issueNow: true,
    },
    {
      patientId: patients[1 % patients.length].id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      payer: {
        name: 'Mutuelle Sante+ Vid',
        type: 'mutuelle',
        email: 'support@mutuelle.test',
      },
      items: [
        { description: 'Inlay-core', quantity: 1, unitPrice: 320 },
        { description: 'Couronne ceramique', quantity: 1, unitPrice: 680 },
      ],
      insuranceClaim: {
        coveragePercent: 70,
        coveredAmount: 700,
        claimNumber: 'CLM-INV-0001',
      },
      issueNow: true,
    },
    {
      patientId: patients[2 % patients.length].id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Facture en attente de validation praticien.',
    },
  ];

  for (const sample of samples) {
    await invoiceService.create(sample as Parameters<typeof invoiceService.create>[0]);
  }

  console.log(`Seeded ${samples.length} invoices (PDF stored via in-memory storage).`);
})()
  .catch((error) => {
    console.error('Invoice seeding failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
