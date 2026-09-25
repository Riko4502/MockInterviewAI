import { z } from "zod";

/**
 * Zod-схема настроек аудио, речи и устройств пользователя для конкретного клиентского устройства.
 * Хранится в отдельной таблице `user_device_settings`.
 */
export const deviceSettingsSchema = z.object({
  clientId: z.string().min(1).max(128),
  deviceName: z.string().max(128).nullable().optional(),
  audioVolume: z.number().min(0).max(100).default(80),
  speechVolume: z.number().min(0).max(100).default(80),
  micGain: z.number().min(0).max(100).default(100),
  preferredAudioInputLabel: z.string().nullable().optional(),
  preferredAudioOutputLabel: z.string().nullable().optional(),
  preferredVideoInputLabel: z.string().nullable().optional(),
});

export type DeviceSettingsDto = z.infer<typeof deviceSettingsSchema>;

/**
 * Zod-схема частичного обновления настроек медиа/устройств для клиентского устройства.
 */
export const updateDeviceSettingsSchema = z.object({
  clientId: z.string().min(1).max(128),
  deviceName: z.string().max(128).optional(),
  audioVolume: z.number().min(0).max(100).optional(),
  speechVolume: z.number().min(0).max(100).optional(),
  micGain: z.number().min(0).max(100).optional(),
  preferredAudioInputLabel: z.string().nullable().optional(),
  preferredAudioOutputLabel: z.string().nullable().optional(),
  preferredVideoInputLabel: z.string().nullable().optional(),
});

export type UpdateDeviceSettingsDto = z.infer<
  typeof updateDeviceSettingsSchema
>;

export const mediaSettingsSchema = deviceSettingsSchema;
export type MediaSettingsDto = DeviceSettingsDto;
export const updateMediaSettingsSchema = updateDeviceSettingsSchema;
export type UpdateMediaSettingsDto = UpdateDeviceSettingsDto;
