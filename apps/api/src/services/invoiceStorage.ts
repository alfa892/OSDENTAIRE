import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

export type InvoiceStorage = {
  uploadPdf: (key: string, body: Buffer) => Promise<void>;
  getSignedUrl: (key: string, ttlSeconds?: number) => Promise<string>;
};

export const createInvoiceStorage = (options: { bucket?: string; region?: string; client?: S3Client } = {}) => {
  const bucket = options.bucket ?? config.invoicePdfBucket;
  if (!bucket) {
    throw new Error('invoice_pdf_bucket_missing');
  }
  const client = options.client ?? new S3Client({ region: options.region ?? config.s3Region });

  const uploadPdf: InvoiceStorage['uploadPdf'] = async (key, body) => {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      })
    );
  };

  const sign: InvoiceStorage['getSignedUrl'] = async (key, ttlSeconds = config.pdfSignedUrlTtlSeconds) => {
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: ttlSeconds }
    );
  };

  return {
    uploadPdf,
    getSignedUrl: sign,
  } satisfies InvoiceStorage;
};

export const createInMemoryInvoiceStorage = () => {
  const store = new Map<string, Buffer>();
  return {
    uploadPdf: async (key: string, body: Buffer) => {
      store.set(key, body);
    },
    getSignedUrl: async (key: string) => {
      if (!store.has(key)) {
        throw new Error('missing_pdf');
      }
      return `https://local-storage/${encodeURIComponent(key)}`;
    },
    dump: () => store,
  } satisfies InvoiceStorage & { dump: () => Map<string, Buffer> };
};
