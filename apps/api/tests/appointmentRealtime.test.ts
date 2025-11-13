import { describe, expect, it, vi } from 'vitest';
import { AppointmentRealtime } from '../src/services/appointmentRealtime';

describe('AppointmentRealtime broker', () => {
  it('stores events in history and exposes cursor', () => {
    const realtime = new AppointmentRealtime<{ id: string }>();
    expect(realtime.getCursor()).toBe(0);
    realtime.emit({ type: 'appointment.created', data: { id: 'a' } });
    realtime.emit({ type: 'appointment.cancelled', data: { id: 'b' } });
    const history = realtime.getSince(0);
    expect(history).toHaveLength(2);
    expect(history[1].cursor).toBe(2);
  });

  it('wait resolves immediately when history exists', async () => {
    const realtime = new AppointmentRealtime<{ id: string }>();
    realtime.emit({ type: 'appointment.created', data: { id: 'c' } });

    const payload = await new Promise<{ events: unknown[]; cursor: number }>((resolve) => {
      realtime.wait(0, resolve);
    });

    expect(payload.events).toHaveLength(1);
    expect(payload.cursor).toBe(1);
  });

  it('flushes after timeout when no events arrive', async () => {
    vi.useFakeTimers();
    const realtime = new AppointmentRealtime<{ id: string }>();

    const promise = new Promise<{ events: unknown[]; cursor: number }>((resolve) => {
      realtime.wait(10, resolve);
    });

    vi.advanceTimersByTime(26000);
    const payload = await promise;
    expect(payload.events).toHaveLength(0);
    expect(payload.cursor).toBe(0);
    vi.useRealTimers();
  });
});
