# Архитектура звонков и созвонов (`features/meeting-call` & `widgets/meeting-room`)

Модуль видеозвонков и комнат встреч реализует клиентскую часть функционала созвонов в реальном времени на базе WebRTC и LiveKit Client SDK. Интерфейс доступен по динамическому маршруту `/meet/[id]` со смешанным доступом (гости и авторизованные пользователи).

---

## 1. Архитектура слоев по FSD

```text
apps/web/src/
├── entities/
│   └── meeting-participant/              # [Entity] Представление участника созвона
│       ├── model/types.ts                # MeetingParticipantState, MeetingReactionItem
│       ├── ui/VideoTile.tsx              # Плитка участника: WebRTC видео, аватар, бейджи, реакции
│       └── index.ts
├── features/
│   └── meeting-call/                     # [Feature] Логика взаимодействия и управления медиа
│       ├── model/
│       │   ├── types.ts                  # DataChannel протокол: сообщения, реакции, поднятие рук
│       │   ├── useMeetingRoom.ts         # Управление LiveKit Room, микрофоном, камерой, шарингом экрана
│       │   └── useMeetingChat.ts         # Отправка/прием чата и реакций через DataChannel
│       ├── ui/
│       │   ├── CallControlsBar.tsx       # Нижняя панель действий (мик, камера, экран, рука, чат, выход)
│       │   ├── MeetingChatSidebar.tsx    # Сайдбар чата с авто-скроллом и кликабельными ссылками
│       │   ├── DeviceSettingsDialog.tsx  # Выбор оборудования из enumerateDevices
│       │   ├── ScreenShareConflictDialog.tsx # Модалка перехвата экрана
│       │   └── CreateMeetingDialog.tsx   # Модалка создания встречи и копирования инвайта
│       └── index.ts
├── widgets/
│   └── meeting-room/                     # [Widget] Полноэкранные композиции созвона
│       ├── ui/
│       │   ├── MeetingRoomWorkspace.tsx  # Главный контейнер (хедер, лейаут, контролы, чат)
│       │   ├── MeetingPreFlightLobby.tsx # Префлайт-лобби предпросмотра оборудования
│       │   ├── MeetingAudioMeter.tsx     # Индикатор громкости микрофона (Web Audio API)
│       │   ├── VideoGrid.tsx             # Адаптивная сетка участников
│       │   └── ScreenShareStage.tsx      # Spotlight-сцена демонстрации экрана
│       └── index.ts
└── app/
    └── meet/[id]/                        # [App Layer] Маршрут страницы встречи
        ├── page.tsx                      # Server Component c <AuthBoundary mode="optional">
        └── MeetingPageClient.tsx         # Client Component оркестрации лобби и звонка
```

---

## 2. Жизненный цикл медиапотоков и устройств

### 2.1 Изоляция префлайт-лобби и звонка
В браузерах на базе Chromium и Firefox повторный захват камеры/микрофона без освобождения ранее открытых дескрипторов приводит к системной ошибке `NotReadableError: Device in use`.

* **В фазе лобби**: компонент [`MeetingPreFlightLobby`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/widgets/meeting-room/ui/MeetingPreFlightLobby.tsx) открывает легковесный `navigator.mediaDevices.getUserMedia()`.
* **В момент нажатия «Войти»**: вызывается явный cleanup всех треков локального стрима:
  ```typescript
  localStream.getTracks().forEach((track) => track.stop());
  ```
* **В фазе звонка**: хук [`useMeetingRoom`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/features/meeting-call/model/useMeetingRoom.ts) инициирует подключение через LiveKit SDK, получая эксклюзивный доступ к устройствам.

### 2.2 Предотвращение эхо-петли (Audio Feedback Loop)
Компонент [`VideoTile`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/entities/meeting-participant/ui/VideoTile.tsx):
* Для **удаленных** участников подключает звуковой трек к скрытому элементу `<audio autoPlay />`.
* Для **локального** участника аудио-трек намеренно игнорируется (`isLocal ? null : track`), чтобы говорящий не слышал собственного эха.

### 2.3 Очистка ресурсов при размонтировании
При уходе участника или отключении камеры вызывается `track.detach(videoElement)`, удаляя привязку WebRTC MediaStreamTrack к DOM-узлам.

---

## 3. Режимы отображения (Layout Modes)

Компонент [`MeetingRoomWorkspace`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/widgets/meeting-room/ui/MeetingRoomWorkspace.tsx) автоматически адаптирует сетку:

1. **Grid Mode ([`VideoGrid`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/widgets/meeting-room/ui/VideoGrid.tsx))**:
   * Раскладка по умолчанию при отсутствии демонстрации экрана.
   * `1 участник`: одна крупная центрированная плитка (16:9).
   * `2 участника`: сетка `1x2` бок о бок.
   * `3–4 участника`: сетка `2x2`.
   * `5–6+ участников`: сетка `3x2` с адаптивным масштабированием.
   * Активный спикер выделяется акцентной пульсирующей рамкой `border-primary`.

2. **Spotlight Stage Mode ([`ScreenShareStage`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/widgets/meeting-room/ui/ScreenShareStage.tsx))**:
   * Активируется автоматически, как только один из участников включает демонстрацию экрана.
   * 80% рабочей области занимает видеопоток расшаренного экрана.
   * Участники звонка компактно размещаются в боковой или нижней полосе (Filmstrip).
   * При попытке второго участника начать демонстрацию отображается диалог разрешения конфликта [`ScreenShareConflictDialog`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/features/meeting-call/ui/ScreenShareConflictDialog.tsx).

---

## 4. Чат и DataChannel в реальном времени

Хук [`useMeetingChat`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/features/meeting-call/model/useMeetingChat.ts) использует LiveKit DataChannel:
* **Текстовые сообщения**: отправляются в топик с надежной доставкой (`reliable: true`). Ссылки в сообщениях автоматически превращаются в кликабельные теги `<a>` с атрибутом `rel="noopener noreferrer"`.
* **Реакции**: всплывающие эмодзи над плитками авторов (`👍`, `❤️`, `👏`, `🔥`, `🎉`) с авто-исчезновением через 3 секунды.
* **Поднятие руки**: тумблер с бейджем `✋ Рука поднята` на плитке участника.
* **Счетчик непрочитанных**: при закрытом сайдбаре на кнопке чата в [`CallControlsBar`](file:///c:/work/MyProjects/MockInterviewAI/apps/web/src/features/meeting-call/ui/CallControlsBar.tsx) отображается красный бейдж количества новых сообщений. Открытие сайдбара сбрасывает счетчик в ноль.
