/* c8 ignore start */
import { ServerClient } from 'postmark';
import { config } from '../config';

export type InvoiceMailer = {
  sendIssued: (payload: { reference: string; totalCents: number; email: string | null; pdfUrl: string | null }) => Promise<void>;
  sendPaymentReceipt: (payload: {
    reference: string;
    amountCents: number;
    email: string | null;
    paymentDate: string;
  }) => Promise<void>;
  sendReminder: (payload: { reference: string; amountCents: number; email: string | null; dueDate: string }) => Promise<void>;
};

const euro = (valueCents: number) => `${(valueCents / 100).toFixed(2)} €`;

export const createInvoiceMailer = (options: { apiKey?: string; fromEmail?: string } = {}): InvoiceMailer => {
  const apiKey = options.apiKey ?? config.postmarkApiKey;
  const fromEmail = options.fromEmail ?? config.postmarkFromEmail;
  if (!apiKey) {
    return {
      sendIssued: async () => undefined,
      sendPaymentReceipt: async () => undefined,
      sendReminder: async () => undefined,
    };
  }

  const client = new ServerClient(apiKey);

  const sendIssued: InvoiceMailer['sendIssued'] = async ({ reference, totalCents, email, pdfUrl }) => {
    if (!email) return;
    await client.sendEmail({
      From: fromEmail,
      To: email,
      Subject: `Votre facture ${reference}`,
      TextBody: `Bonjour,\n\nVotre facture ${reference} est disponible pour un montant de ${euro(totalCents)}.\nTéléchargez-la: ${
        pdfUrl ?? 'Connectez-vous au portail patient'
      }.\n\nMerci,\nCabinet OSdentaire`,
    });
  };

  const sendPaymentReceipt: InvoiceMailer['sendPaymentReceipt'] = async ({ reference, amountCents, email, paymentDate }) => {
    if (!email) return;
    await client.sendEmail({
      From: fromEmail,
      To: email,
      Subject: `Paiement reçu pour ${reference}`,
      TextBody: `Bonjour,\n\nNous confirmons la réception de ${euro(amountCents)} sur la facture ${reference} le ${paymentDate}.\n\nMerci !\nCabinet OSdentaire`,
    });
  };

  const sendReminder: InvoiceMailer['sendReminder'] = async ({ reference, amountCents, email, dueDate }) => {
    if (!email) return;
    await client.sendEmail({
      From: fromEmail,
      To: email,
      Subject: `Relance facture ${reference}`,
      TextBody: `Bonjour,\n\nLa facture ${reference} d'un montant de ${euro(amountCents)} est échue depuis le ${dueDate}.\nMerci de procéder au règlement ou de contacter le cabinet.\n\nEquipe OSdentaire`,
    });
  };

  return {
    sendIssued,
    sendPaymentReceipt,
    sendReminder,
  };
};

export const createMemoryMailer = () => {
  const issued: Parameters<InvoiceMailer['sendIssued']>[0][] = [];
  const receipts: Parameters<InvoiceMailer['sendPaymentReceipt']>[0][] = [];
  const reminders: Parameters<InvoiceMailer['sendReminder']>[0][] = [];
  return {
    issued,
    receipts,
    reminders,
    sendIssued: async (payload: Parameters<InvoiceMailer['sendIssued']>[0]) => {
      issued.push(payload);
    },
    sendPaymentReceipt: async (payload: Parameters<InvoiceMailer['sendPaymentReceipt']>[0]) => {
      receipts.push(payload);
    },
    sendReminder: async (payload: Parameters<InvoiceMailer['sendReminder']>[0]) => {
      reminders.push(payload);
    },
  } satisfies InvoiceMailer & { issued: typeof issued; receipts: typeof receipts; reminders: typeof reminders };
};
/* c8 ignore end */
