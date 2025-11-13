import type { AppointmentDTO } from './appointmentService';

export type AppointmentEventType = 'appointment.created' | 'appointment.cancelled';

export type AppointmentRealtimeEvent<TData = unknown> = {
  type: AppointmentEventType;
  data: TData;
  cursor: number;
};

type PendingListener<TData = unknown> = {
  cursor: number;
  callback: (payload: { events: AppointmentRealtimeEvent<TData>[]; cursor: number }) => void;
  timeout: NodeJS.Timeout;
};

export class AppointmentRealtime<TData = unknown> {
  private revision = 0;
  private history: AppointmentRealtimeEvent<TData>[] = [];
  private readonly waiters = new Set<PendingListener<TData>>();
  private readonly historyLimit: number;

  constructor(options: { historyLimit?: number } = {}) {
    this.historyLimit = options.historyLimit ?? 50;
  }

  getCursor() {
    return this.revision;
  }

  emit(event: { type: AppointmentEventType; data: TData }) {
    this.revision += 1;
    const payload: AppointmentRealtimeEvent<TData> = { ...event, cursor: this.revision };
    this.history.push(payload);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    for (const waiter of [...this.waiters]) {
      const events = this.getSince(waiter.cursor);
      if (events.length > 0) {
        clearTimeout(waiter.timeout);
        this.waiters.delete(waiter);
        waiter.callback({ events, cursor: this.revision });
      }
    }

    return payload;
  }

  getSince(cursor: number) {
    if (!cursor) return [...this.history];
    return this.history.filter((event) => event.cursor > cursor);
  }

  wait(cursor: number, callback: PendingListener<TData>['callback'], timeoutMs = 25000) {
    const events = this.getSince(cursor);
    if (events.length > 0) {
      callback({ events, cursor: this.revision });
      return () => undefined;
    }

    const pending: PendingListener<TData> = {
      cursor,
      callback,
      timeout: setTimeout(() => {
        this.waiters.delete(pending);
        callback({ events: [], cursor: this.revision });
      }, timeoutMs),
    };
    this.waiters.add(pending);

    return () => {
      clearTimeout(pending.timeout);
      this.waiters.delete(pending);
    };
  }
}

export type AppointmentRealtimeInstance = AppointmentRealtime<AppointmentDTO>;

export const appointmentRealtime: AppointmentRealtimeInstance = new AppointmentRealtime<AppointmentDTO>();
