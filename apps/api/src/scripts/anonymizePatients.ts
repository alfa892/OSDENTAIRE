import 'dotenv/config';
import { db, dbPool } from '../db/client';
import { createPatientService } from '../services/patientService';

const retentionDays = Number(process.env.PATIENTS_RETENTION_DAYS ?? 730);
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

(async () => {
  const service = createPatientService(db);
  const count = await service.anonymize(cutoff);
  console.log(`Anonymized ${count} patient(s) soft-deleted before ${cutoff.toISOString()}`);
})()
  .catch((error) => {
    console.error('Anonymization failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
