/**
 * Воспроизведение тестового звукового сигнала на выбранном устройстве вывода
 * с учётом установленной громкости.
 */
export async function playChimeSound(
  volume: number,
  sinkId?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();

    // Поддержка setSinkId на AudioContext (современный Chromium)
    if (
      sinkId &&
      typeof (ctx as unknown as { setSinkId?: (id: string) => Promise<void> })
        .setSinkId === "function"
    ) {
      try {
        await (
          ctx as unknown as { setSinkId: (id: string) => Promise<void> }
        ).setSinkId(sinkId);
      } catch (err) {
        console.warn("[SoundTest] Failed to set sinkId on AudioContext:", err);
      }
    }

    const gain = ctx.createGain();
    // Нормализуем громкость (0 - 100% -> 0 - 0.25 gain чтобы не оглушить)
    const masterGain = (Math.max(0, Math.min(100, volume)) / 100) * 0.25;
    gain.gain.setValueAtTime(masterGain, ctx.currentTime);

    // Мелодичный 3-тональный аккорд (До - Ми - Соль: C5 - E5 - G5)
    const notes = [
      { freq: 523.25, start: 0, duration: 0.12 },
      { freq: 659.25, start: 0.12, duration: 0.12 },
      { freq: 783.99, start: 0.24, duration: 0.26 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
      osc.connect(gain);
      osc.start(ctx.currentTime + note.start);
      osc.stop(ctx.currentTime + note.start + note.duration);
    }

    // Плавное затухание в конце
    gain.gain.setValueAtTime(masterGain, ctx.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

    gain.connect(ctx.destination);

    // Закрываем контекст после завершения проигрывания
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 650);
  } catch (err) {
    console.warn("[SoundTest] Error playing chime sound:", err);
  }
}
