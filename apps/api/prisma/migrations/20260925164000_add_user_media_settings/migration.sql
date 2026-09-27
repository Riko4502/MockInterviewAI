-- CreateTable
CREATE TABLE "user_device_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "device_name" VARCHAR(128),
    "audio_volume" INTEGER NOT NULL DEFAULT 80,
    "speech_volume" INTEGER NOT NULL DEFAULT 80,
    "mic_gain" INTEGER NOT NULL DEFAULT 100,
    "preferred_audio_input_label" VARCHAR(255),
    "preferred_audio_output_label" VARCHAR(255),
    "preferred_video_input_label" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_device_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_device_settings_user_id_client_id_key" ON "user_device_settings"("user_id", "client_id");

-- CreateIndex
CREATE INDEX "user_device_settings_user_id_idx" ON "user_device_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_device_settings" ADD CONSTRAINT "user_device_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
