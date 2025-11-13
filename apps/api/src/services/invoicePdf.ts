/* c8 ignore start */
import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';

export type InvoicePdfTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateBps: number;
  totalExclTaxCents: number;
  totalTaxCents: number;
};

export type InvoicePdfPayment = {
  source: string;
  method: string;
  amountCents: number;
  paidAt: string;
  reference: string | null;
};

export type InvoicePdfPayload = {
  invoice: {
    reference: string;
    issuedAt: string | null;
    dueDate: string;
    notes: string | null;
    status: string;
    totals: InvoicePdfTotals;
  };
  patient: {
    fullName: string;
    reference: string;
  };
  payer: {
    name: string;
    type: string;
    email: string | null;
  };
  items: InvoicePdfItem[];
  payments: InvoicePdfPayment[];
};

const formatEuro = (valueCents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(valueCents / 100);

const formatDate = (value: string | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(value));
};

const drawTable = (doc: PDFKit.PDFDocument, items: InvoicePdfItem[]) => {
  const startX = 50;
  const colWidths = [230, 60, 80, 90];
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('Acte / description', startX, doc.y, { width: colWidths[0] });
  doc.text('Qté', startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
  doc.text('PU HT', startX + colWidths[0] + colWidths[1], doc.y, { width: colWidths[2], align: 'right' });
  doc.text('Total TTC', startX + colWidths[0] + colWidths[1] + colWidths[2], doc.y, {
    width: colWidths[3],
    align: 'right',
  });
  doc.moveDown(0.5);
  doc.font('Helvetica');
  for (const item of items) {
    doc.text(item.description, startX, doc.y, { width: colWidths[0] });
    doc.text(`${item.quantity}`, startX + colWidths[0], doc.y, { width: colWidths[1], align: 'right' });
    doc.text(formatEuro(item.unitPriceCents), startX + colWidths[0] + colWidths[1], doc.y, {
      width: colWidths[2],
      align: 'right',
    });
    const totalTtc = item.totalExclTaxCents + item.totalTaxCents;
    doc.text(formatEuro(totalTtc), startX + colWidths[0] + colWidths[1] + colWidths[2], doc.y, {
      width: colWidths[3],
      align: 'right',
    });
    doc.moveDown(0.3);
  }
};

export const generateInvoicePdf = (payload: InvoicePdfPayload) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0ea5e9').text('OSdentaire', { align: 'right' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#111827').font('Helvetica').text('Cabinet OSdentaire', { align: 'right' });
    doc.text('42 Rue Oberkampf');
    doc.text('75011 Paris');
    doc.moveDown();

    doc.fontSize(18).fillColor('#0f172a').font('Helvetica-Bold').text(`Facture ${payload.invoice.reference}`);
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#0f172a');
    doc.text(`Status: ${payload.invoice.status.toUpperCase()} · Emit le ${formatDate(payload.invoice.issuedAt)}`);
    doc.text(`Échéance: ${formatDate(payload.invoice.dueDate)}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Patient');
    doc.fontSize(11).font('Helvetica').text(`${payload.patient.fullName} (${payload.patient.reference})`);
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Payeur');
    doc.fontSize(11).font('Helvetica').text(`${payload.payer.name} · ${payload.payer.type}`);
    if (payload.payer.email) {
      doc.text(payload.payer.email);
    }
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Détails');
    doc.moveDown(0.2);
    drawTable(doc, payload.items);

    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text('Totaux');
    doc.fontSize(11).font('Helvetica');
    doc.text(`Sous-total HT: ${formatEuro(payload.invoice.totals.subtotalCents)}`);
    doc.text(`TVA: ${formatEuro(payload.invoice.totals.taxCents)}`);
    doc.text(`Montant TTC: ${formatEuro(payload.invoice.totals.totalCents)}`);
    doc.text(`Déjà réglé: ${formatEuro(payload.invoice.totals.paidCents)}`);
    doc.text(`Solde restant: ${formatEuro(payload.invoice.totals.balanceCents)}`);

    if (payload.payments.length > 0) {
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text('Paiements reçus');
      doc.fontSize(11).font('Helvetica');
      for (const payment of payload.payments) {
        doc.text(
          `${formatDate(payment.paidAt)} · ${payment.source} (${payment.method}) · ${formatEuro(payment.amountCents)}${
            payment.reference ? ` · Ref ${payment.reference}` : ''
          }`
        );
      }
    }

    if (payload.invoice.notes) {
      doc.moveDown();
      doc.fontSize(11).font('Helvetica-Oblique').text(`Notes: ${payload.invoice.notes}`);
    }

    doc.moveDown(1.5);
    doc.fontSize(8)
      .fillColor('#4b5563')
      .text('TVA 20% incluse sauf mention contraire · Mentions légales: soins dentaires soumis au Code de la santé publique.');
    doc.text(
      'Données traitées conformément au RGPD. Contact DPO: dpo@osdentaire.com · Paiement sécurisé SEPA / CB. '
    );

    doc.end();
  });
/* c8 ignore end */
