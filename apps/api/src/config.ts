import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const rateFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed > 1) {
    return parsed / 100;
  }
  return parsed;
};

export const config = {
  port: numberFromEnv(process.env.API_PORT ?? process.env.PORT, 5050),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  appointmentSlotMinutes: numberFromEnv(process.env.APPOINTMENTS_SLOT_MINUTES, 15),
  invoicePdfBucket: process.env.INVOICE_PDF_BUCKET ?? 'osdentaire-invoices',
  s3Region: process.env.AWS_REGION ?? 'eu-west-3',
  pdfSignedUrlTtlSeconds: numberFromEnv(process.env.INVOICE_PDF_URL_TTL, 900),
  tvaRate: rateFromEnv(process.env.TVA_RATE, 0.2),
  postmarkApiKey: process.env.POSTMARK_API_KEY ?? '',
  postmarkFromEmail: process.env.POSTMARK_FROM_EMAIL ?? 'facturation@osdentaire.test',
};
