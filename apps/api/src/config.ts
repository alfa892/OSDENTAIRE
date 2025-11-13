import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  port: numberFromEnv(process.env.API_PORT ?? process.env.PORT, 5050),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  appointmentSlotMinutes: numberFromEnv(process.env.APPOINTMENTS_SLOT_MINUTES, 15),
};
