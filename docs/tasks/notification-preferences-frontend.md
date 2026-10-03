# Задачи: Фронтенд настроек уведомлений в профиле (Notification Preferences UI)

Данный документ содержит детальную спецификацию и пошаговую декомпозицию задач для разработки пользовательского интерфейса управления уведомлениями (**Notification Preferences UI**) в приложении **`apps/web`** (Next.js App Router, архитектура **FSD**), с использованием дизайн-системы **`@packages/ui`** (`Switch`, `Card`, `Badge`, `Alert`, `Select`, `Button`, `Skeleton`, `Toast`), иконок **`@packages/icons`**, типизированных хуков **`@packages/api`** (TanStack Query) и мультиязычности **`@packages/i18n`**.

---

## 1. Концепция интерфейса и ключевые правила отображения

Вкладка «Уведомления» встраивается в сайдбар настроек профиля (`UpdateProfileForm.tsx`) как самостоятельный раздел наряду с «Профиль», «Связанные аккаунты» и «Безопасность».

### Ключевые требования к UI/UX:
1. **Каналы доставки сгруппированы в карточки**:
   - 📧 **Электронная почта (Email)** — отображается всегда.
   - 🔔 **Уведомления на сайте (In-App)** — отображается всегда.
   - ✈️ **Telegram** — **отображается ТОЛЬКО если Telegram подключен** (`isTelegramLinked === true`).
2. **Поведение, если Telegram НЕ подключен**:
   - Колонка с переключателями Telegram скрывается.
   - Вместо нее выводится заметный, но аккуратный CTA-баннер с кнопкой «Подключить Telegram», ведущей на вкладку «Связанные аккаунты».
3. **Мастер-переключатель в шапке карточки (Master Toggle)**:
   - В заголовке каждой карточки (Email, Telegram, Сайт) расположен переключатель, позволяющий в 1 клик выключить или включить все уведомления данного канала.
4. **Кнопка «Проверить доставку» (Test Delivery)**:
   - В каждой карточке канала есть компактная кнопка «Проверить доставку», отправляющая тестовый пуш/письмо, с индикатором отправки и тостом об успешной доставке.
5. **Настраиваемое время напоминаний (Lead Time Select)**:
   - В блоке напоминаний о сессиях пользователь может выбрать комфортное время упреждения: `15 минут`, `30 минут`, `1 час`, `24 часа`.
6. **«Тихие часы» (Quiet Hours / Do Not Disturb)**:
   - Отдельный блок настроек: свитч включения тихих часов + поля выбора времени начала (`23:00`) и окончания (`08:00`), а также отображение текущей таймзоны.
7. **Критические уведомления безопасности (Транзакционные)**:
   - Оповещения о сбросе пароля и смене email отображаются с бейджем `Обязательно` и заблокированным `Switch (checked=true, disabled=true)` с тултипом *«Нельзя отключить из соображений безопасности аккаунта»*.
8. **Optimistic UI (Мгновенный отклик)**:
   - Состояние любого свитча переключается мгновенно без спиннеров на весь экран.
   - Запрос `PATCH /api/v1/profile/notification-preferences` отправляется в фоне. При сетевом сбое состояние возвращается в исходное с нотификацией через `useToast`.

---

## 2. Макет и визуальная структура (Responsive Grid Layout)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Уведомления                                                                │
│  Управляйте каналами доставки, расписанием напоминаний и тихими часами      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│ 📧 Электронная почта                         │ │ 🔔 На сайте (In-App)                         │
│ [Проверить доставку]           [Вкл. все: ON]│ │ [Проверить доставку]           [Вкл. все: ON]│
│                                              │ │                                              │
│ 🎯 Приглашения на собеседования      [ ON  ] │ │ 🎯 Приглашения на собеседования      [ ON  ] │
│    Когда кто-то откликается на вашу заявку   │ │    Всплывающие уведомления в шапке сайта     │
│                                              │ │                                              │
│ ⏰ Напоминания о сессиях              [ ON  ] │ │ ⏰ Напоминания о сессиях              [ ON  ] │
│    За 1 час до начала интервью               │ │    Всплывающее окно перед сессией            │
│                                              │ │                                              │
│ ❌ Отмена или перенос сессии         [ ON  ] │ │ ❌ Отмена или перенос сессии         [ ON  ] │
│    Если собеседник изменил слот              │ │    Мгновенный алерт в комнате и на сайте     │
│                                              │ │                                              │
│ ⭐ Готовность фидбека и оценки       [ ON  ] │ │ ⭐ Готовность фидбека и оценки       [ ON  ] │
│    Когда партнер заполнил ревью или AI-отчет │ │    Уведомление о новом отчете                │
│                                              │ │                                              │
│ 📚 Дайджест новых задач              [ OFF ] │ │ 📚 Дайджест новых задач              [ OFF ] │
│    Еженедельная подборка вопросов            │ │    Оповещения о новых задачах                │
│                                              │ │                                              │
│ 🛡️ Вход с нового устройства          [ ON  ] │ │ 🔊 Звуковой сигнал при уведомлении   [ ON  ] │
│    Оповещение о подозрительной активности    │ │    Приятный щелчок при новом событии         │
│                                              │ └──────────────────────────────────────────────┘
│ 🔒 Восстановление доступа [Обязательно][LOCK]│
│    Сброс пароля и коды подтверждения         │
└──────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ✈️ Telegram (Отображается ТОЛЬКО если Telegram подключен)                    │
│ [Проверить доставку]                                          [Вкл. все: ON]│
│                                                                             │
│ 🎯 Приглашения на собеседования                                     [ ON  ] │
│ ⏰ Напоминания со ссылкой в комнату                                 [ ON  ] │
│ ❌ Отмена или перенос собеседования                                 [ ON  ] │
│ ⭐ Уведомления о готовом фидбеке                                    [ ON  ] │
│ 📚 Дайджест новых задач                                             [ OFF ] │
│ 🛡️ Вход с нового устройства                                         [ ON  ] │
└─────────────────────────────────────────────────────────────────────────────┘

  * Если Telegram НЕ подключен, вместо блока Telegram отображается баннер:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✈️ Получайте мгновенные уведомления в Telegram                              │
│ Привяжите ваш Telegram-аккаунт, чтобы не пропустить собеседование           │
│ и оперативно получать прямые ссылки на вход в комнату.                      │
│                                           [ Подключить Telegram -> ]        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ Общие параметры доставки и расписания                                    │
│                                                                             │
│ ⏱️ Напоминать о начале собеседования за:                                    │
│    [ Выпадающий список: 15 минут | 30 минут | 1 час | За 24 часа  ▼ ]        │
│                                                                             │
│ 🌙 Режим «Тихие часы» (Не беспокоить)                               [ ON  ] │
│    В этот период Telegram-бот не присылает некритические сообщения со звуком│
│    Интервал: с [ 23:00 ] по [ 08:00 ] (Часовой пояс: Europe/Moscow)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Архитектура FSD (`apps/web`)

```text
apps/web/src/
├── features/
│   └── update-notification-preferences/           # Фича настроек уведомлений
│       ├── ui/
│       │   ├── NotificationPreferencesTab.tsx     # Главный контейнер вкладки
│       │   ├── NotificationChannelCard.tsx        # Карточка канала (Email / TG / In-App)
│       │   ├── NotificationToggleItem.tsx         # Строка переключателя с иконкой
│       │   ├── QuietHoursSettingsCard.tsx         # Блок настройки тихих часов и lead-time
│       │   ├── TelegramConnectBanner.tsx          # CTA баннер привязки Telegram
│       │   ├── TestDeliveryButton.tsx             # Кнопка тестовой отправки с лоадером
│       │   └── NotificationPreferencesSkeleton.tsx
│       ├── model/
│       │   ├── use-notification-preferences.ts    # TanStack Query (query, patch, test mutation)
│       │   └── types.ts                           # Типы настроек и ответов API
│       ├── index.ts                               # Публичный интерфейс фичи
│       └── ui/NotificationPreferencesTab.test.tsx # Тесты
│
└── features/update-profile/
    └── ui/
        └── UpdateProfileForm.tsx                  # Вкладка "Уведомления" в меню профиля
```

---

## 4. Интеграция в форму профиля (`UpdateProfileForm.tsx`)

В [`UpdateProfileForm.tsx`](file:///d:/%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D1%8B/MockInterviewAI/apps/web/src/features/update-profile/ui/UpdateProfileForm.tsx):
1. Добавляем тип вкладки: `type ProfileTab = "general" | "accounts" | "security" | "notifications";`
2. В `Tabs.List` добавляем кнопку с `BellIcon`:
   ```tsx
   <Tabs.Trigger
     value="notifications"
     className="w-full justify-start gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
   >
     <BellIcon size="sm" className="size-4 shrink-0" />
     <span>{t("profile.tabs.notifications")}</span>
   </Tabs.Trigger>
   ```
3. В `Tabs.Content` рендерим компонент:
   ```tsx
   <Tabs.Content value="notifications" className="mt-0">
     <NotificationPreferencesTab
       user={user}
       onNavigateToAccounts={() => setActiveTab("accounts")}
     />
   </Tabs.Content>
   ```

---

## 5. Хуки управления данными (Optimistic Updates & Test Delivery)

В `features/update-notification-preferences/model/use-notification-preferences.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@packages/ui";
import { useTranslation } from "react-i18next";

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["profile", "notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/v1/profile/notification-preferences");
      if (!res.ok) throw new Error("Failed to load notification preferences");
      return res.json();
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("common");

  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await fetch("/api/v1/profile/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["profile", "notification-preferences"] });
      const previous = queryClient.getQueryData(["profile", "notification-preferences"]);

      queryClient.setQueryData(["profile", "notification-preferences"], (old: any) => {
        if (!old) return old;
        return { ...old, ...patch };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["profile", "notification-preferences"], context.previous);
      }
      toast.push({
        status: "error",
        title: t("profile.notifications.saveError"),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "notification-preferences"] });
    },
  });
}

export function useSendTestNotification() {
  const toast = useToast();
  const { t } = useTranslation("common");

  return useMutation({
    mutationFn: async (channel: "EMAIL" | "TELEGRAM" | "IN_APP") => {
      const res = await fetch("/api/v1/profile/notification-preferences/test-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) throw new Error("Delivery test failed");
      return res.json();
    },
    onSuccess: () => {
      toast.push({
        status: "success",
        title: t("profile.notifications.testSuccess"),
      });
    },
    onError: () => {
      toast.push({
        status: "error",
        title: t("profile.notifications.testError"),
      });
    },
  });
}
```

---

## 6. Локализация (`packages/i18n`)

Добавляемые ключи в `common.json` (`ru` / `en`):

```json
{
  "profile": {
    "tabs": {
      "notifications": "Уведомления"
    },
    "notifications": {
      "title": "Настройки уведомлений",
      "subtitle": "Управляйте каналами доставки, расписанием напоминаний и тихими часами.",
      "masterToggle": "Включить все",
      "testButton": "Проверить доставку",
      "testSuccess": "Тестовое уведомление успешно отправлено!",
      "testError": "Не удалось отправить тестовое уведомление",
      "channels": {
        "email": "Электронная почта",
        "emailDesc": "Письма на адрес {{email}}",
        "telegram": "Telegram",
        "telegramDesc": "Оповещения в боте @{{username}}",
        "inApp": "Уведомления на сайте",
        "inAppDesc": "Всплывающие уведомления и колокольчик в шапке"
      },
      "events": {
        "sessionInvites": "Приглашения на собеседования",
        "sessionInvitesDesc": "Когда другой кандидат откликается на вашу заявку или зовет в сессию",
        "interviewReminders": "Напоминания о сессиях",
        "interviewRemindersDesc": "Заблаговременное напоминание со ссылкой для входа в комнату",
        "sessionCancelled": "Отмена или перенос сессии",
        "sessionCancelledDesc": "Если участник отменил собеседование или изменил время",
        "feedbackReady": "Готовность фидбека и оценки",
        "feedbackReadyDesc": "Когда собеседник заполнил отзыв или сформирован AI-отчет",
        "newProblemsDigest": "Дайджест новых задач",
        "newProblemsDigestDesc": "Еженедельная подборка новых алгоритмических задач для практики",
        "securityNewLogin": "Вход с нового устройства",
        "securityNewLoginDesc": "Оповещение при обнаружении входа с незнакомого браузера или IP",
        "inAppSound": "Звуковой сигнал при уведомлении",
        "inAppSoundDesc": "Приятный звуковой сигнал при получении нового события на сайте",
        "criticalSecurity": "Восстановление доступа",
        "criticalSecurityDesc": "Сброс пароля и коды верификации (обязательно для безопасности)",
        "requiredBadge": "Обязательно"
      },
      "schedule": {
        "title": "Расписание и тихие часы",
        "leadTimeLabel": "Напоминать о начале собеседования за",
        "leadTimeOptions": {
          "15": "15 минут",
          "30": "30 минут",
          "60": "1 час",
          "1440": "24 часа"
        },
        "quietHoursTitle": "Режим «Тихие часы» (Не беспокоить)",
        "quietHoursDesc": "В этот период Telegram-бот не присылает некритические сообщения со звуком",
        "from": "С",
        "to": "До",
        "timezone": "Часовой пояс: {{tz}}"
      },
      "telegramBanner": {
        "title": "Получайте мгновенные уведомления в Telegram",
        "description": "Привяжите Telegram-аккаунт, чтобы не пропустить собеседования и получать прямые ссылки на вход в комнату прямо в мессенджер.",
        "connectButton": "Подключить Telegram"
      },
      "saveError": "Не удалось сохранить настройки уведомлений"
    }
  }
}
```

---

## 7. Декомпозиция задач для Frontend

- [ ] **Task 1: Модели и хуки фичи (`features/update-notification-preferences`)**
  - Создать `model/types.ts` с типами настроек.
  - Реализовать TanStack Query хуки: `useNotificationPreferences`, `useUpdateNotificationPreferences` (с optimistic updates), `useSendTestNotification`.

- [ ] **Task 2: UI-компоненты фичи**
  - `NotificationToggleItem.tsx`: отдельная строка с иконкой, текстом, бейджем и `Switch`.
  - `NotificationChannelCard.tsx`: карточка канала с заголовком, мастер-тумблером и кнопкой «Проверить доставку».
  - `QuietHoursSettingsCard.tsx`: блок выбора `leadTime` и интервала тихих часов (`23:00` - `08:00`).
  - `TelegramConnectBanner.tsx`: баннер подключения TG с кнопкой перехода.
  - `NotificationPreferencesTab.tsx`: компоновка карточек (Email, Сайт, условный рендер Telegram по `isTelegramLinked`, блок расписания).

- [ ] **Task 3: Интеграция в `UpdateProfileForm.tsx`**
  - Добавить вкладку `notifications` с `BellIcon` в вертикальный список табов.
  - Поддержать query-параметр URL `?tab=notifications`.
  - Подключить переход из баннера Telegram на вкладку `accounts`.

- [ ] **Task 4: Локализация (`@packages/i18n`)**
  - Заполнить ключи `profile.notifications.*` в словарях `ru` и `en`.

- [ ] **Task 5: Тестирование (`NotificationPreferencesTab.test.tsx`)**
  - Тест 1: Рендер карточек Email и In-App.
  - Тест 2: **Проверка скрытия колонки Telegram**, если `isTelegramLinked = false`, и рендер баннера.
  - Тест 3: **Проверка отображения колонки Telegram**, если `isTelegramLinked = true`.
  - Тест 4: Работа мастер-тумблера (включение/выключение всех свитчей канала).
  - Тест 5: Кнопка тестовой отправки вызывает API и показывает toast.
  - Тест 6: Критический свитч сброса пароля заблокирован в состоянии ON.
