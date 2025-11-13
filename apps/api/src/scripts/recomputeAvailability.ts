import 'dotenv/config';
import { and, asc, eq, gt } from 'drizzle-orm';
import { db, dbPool } from '../db/client';
import { appointments, providers } from '../db/schema';

(async () => {
  const providerRows = await db.select({ id: providers.id, fullName: providers.fullName }).from(providers);
  const now = new Date();

  for (const provider of providerRows) {
    const [nextSlot] = await db
      .select({ startAt: appointments.startAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, provider.id),
          eq(appointments.status, 'scheduled'),
          gt(appointments.startAt, now)
        )
      )
      .orderBy(asc(appointments.startAt))
      .limit(1);

    await db
      .update(providers)
      .set({
        nextAvailableAt: nextSlot?.startAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, provider.id));

    console.log(
      `Provider ${provider.fullName}: next availability ${nextSlot?.startAt?.toISOString() ?? 'disponible maintenant'}`
    );
  }

  console.log('Availability refreshed');
})()
  .catch((error) => {
    console.error('Availability refresh failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await dbPool.end();
  });
