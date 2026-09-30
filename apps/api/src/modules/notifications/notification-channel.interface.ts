import type { NotificationEvent } from "@packages/dto";

/**
 * Общий интерфейс доставки уведомления (ADR-003:50).
 *
 * Каналы добавляются регистрацией нового адаптера: доменные сервисы от этого не
 * меняются, и диспетчер не правится, кроме добавления адаптера в список.
 */
export interface NotificationChannelDelivery {
  event: NotificationEvent;
  recipientId: string;
  actionUrl?: string;
}

export interface NotificationChannel {
  /** Имя канала попадает в логи и метрики, поэтому оно стабильное. */
  readonly name: string;

  deliver(delivery: NotificationChannelDelivery): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol("NOTIFICATION_CHANNELS");
