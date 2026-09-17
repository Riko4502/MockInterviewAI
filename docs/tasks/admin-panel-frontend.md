# Задачи: Фронтенд административной панели и управления пользователями (Admin Panel & Users Management UI)

Данный документ содержит детальную декомпозицию задач для реализации пользовательского интерфейса административной панели (**Admin Panel**) и раздела управления пользователями (**Users Management UI**) в приложении **`apps/web`** (Next.js App Router, архитектура **FSD**), с использованием дизайн-системы **`@packages/ui`** (`DataTable`, `Dialog`, `Badge`, `Pagination`, `Form`, `Toast`), иконок **`@packages/icons`** и интеграции с **Admin Users API**.

---

## 1. Архитектурная диаграмма взаимодействия компонентов (Admin UI Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 👑 Администратор
    participant Page as 📄 /admin/users Page (App Router)
    participant FilterWidget as 🔍 AdminUsersFilter
    participant TableWidget as 📊 AdminUsersTable (widgets)
    participant Query as ⚡ TanStack Query (entities/admin-user)
    participant Modal as 🪟 Create/Edit/Status Dialogs (features)
    participant API as 🚀 Backend /api/v1/admin/users

    Admin->>Page: Открытие страницы /admin/users
    Page->>Query: useAdminUsers({ page, limit, search, role, isActive, sortBy, sortOrder })
    Query->>API: GET /api/v1/admin/users?...
    API-->>Query: { items: UserAdminDto[], meta: PaginationMetaDto }
    Query-->>TableWidget: Рендер строк пользователей (бейджи, даты, аватары, действия)
    TableWidget-->>Admin: Отображение таблицы с пагинацией

    %% Поиск и фильтрация
    Admin->>FilterWidget: Ввод в поле поиска "alex" (debounce 300ms)
    FilterWidget->>Query: Обновление query params (reset page = 1)
    Query->>API: GET /api/v1/admin/users?search=alex&page=1
    API-->>Query: Отфильтрованный список
    Query-->>TableWidget: Мгновенное обновление таблицы

    %% Активация / Деактивация
    Admin->>TableWidget: Клик "Деактивировать" в строке пользователя
    TableWidget->>Modal: Открытие ToggleStatusDialog с предупреждением
    Admin->>Modal: Подтверждение блокировки
    Modal->>API: PATCH /api/v1/admin/users/:id/status { isActive: false }
    API-->>Modal: 200 OK (пользователь деактивирован)
    Modal->>Query: Инвалидация кэша ['admin', 'users']
    Modal->>Admin: Toast "Пользователь успешно деактивирован, сессии отозваны"
    Query-->>TableWidget: Перерисовка статуса на "Деактивирован"
```

---

## 2. Структура файлов в `apps/web` (FSD методология)

```text
apps/web/src/
├── app/
│   └── (protected)/
│       └── admin/
│           ├── layout.tsx                                 # Обертка RoleBoundary(ADMIN) + админский лейаут
│           └── users/
│               ├── page.tsx                               # Страница /admin/users
│               └── [id]/
│                   └── page.tsx                           # Детальная карточка пользователя (опционально)
│
├── entities/
│   └── admin-user/
│       ├── api/
│       │   ├── admin-users.api.ts                         # Вызовы REST API (getUsers, getUser, createUser, updateUser, toggleStatus, resetPassword, deleteUser, restoreUser)
│       │   └── admin-users.queries.ts                     # TanStack Query хуки: useAdminUsers, useAdminUserDetail
│       ├── model/
│       │   └── types.ts                                   # Типы фильтров, таблицы, статусов
│       ├── ui/
│       │   ├── UserRoleBadge.tsx                          # Бейдж роли: "ADMIN" (фиолетовый) / "USER" (серый)
│       │   ├── UserStatusBadge.tsx                        # Бейдж статуса: "Активен" (зеленый) / "Деактивирован" (красный) / "Удален" (серый)
│       │   └── UserAvatarCell.tsx                         # Ячейка с аватаром, именем и username
│       └── index.ts
│
├── features/
│   ├── admin-users-filter/
│   │   ├── ui/
│   │   │   ├── AdminUsersFilter.tsx                       # Поисковая строка (debounced), селекторы роли, активности и статуса удаления (isDeleted), сброс
│   │   │   └── AdminUsersFilter.test.tsx
│   │   ├── model/
│   │   │   └── useAdminUsersFilterState.ts                # Синхронизация фильтров с URLSearchParams
│   │   └── index.ts
│   │
│   ├── admin-user-create/
│   │   ├── ui/
│   │   │   ├── CreateUserDialog.tsx                       # Модальное окно создания пользователя (email, role, username, displayName — БЕЗ пароля)
│   │   │   └── CreateUserDialog.test.tsx
│   │   ├── model/
│   │   │   ├── useCreateUserForm.ts                       # React Hook Form + Zod валидация (createUserAdminSchema)
│   │   │   └── useCreateUserMutation.ts                   # TanStack Mutation + toast + инвалидация кэша
│   │   └── index.ts
│   │
│   ├── admin-user-edit/
│   │   ├── ui/
│   │   │   ├── EditUserDialog.tsx                         # Модальное окно редактирования (без пароля, с блокировкой смены роли для самого себя)
│   │   │   └── EditUserDialog.test.tsx
│   │   ├── model/
│   │   │   ├── useEditUserForm.ts
│   │   │   └── useUpdateUserMutation.ts
│   │   └── index.ts
│   │
│   ├── admin-user-status/
│   │   ├── ui/
│   │   │   ├── ToggleStatusDialog.tsx                     # Диалог подтверждения деактивации/активации (с Self-Lockout защитой)
│   │   │   └── ToggleStatusDialog.test.tsx
│   │   ├── model/
│   │   │   └── useToggleStatusMutation.ts
│   │   └── index.ts
│   │
│   ├── admin-user-reset-password/
│   │   ├── ui/
│   │   │   ├── ResetPasswordDialog.tsx                    # Диалог подтверждения сброса пароля сервером
│   │   │   └── ResetPasswordDialog.test.tsx
│   │   ├── model/
│   │   │   └── useResetPasswordMutation.ts
│   │   └── index.ts
│   │
│   ├── admin-user-lifecycle/
│   │   ├── ui/
│   │   │   ├── DeleteUserDialog.tsx                       # Диалог мягкого удаления (с Self-Deletion защитой)
│   │   │   ├── RestoreUserDialog.tsx                      # Диалог восстановления удаленного аккаунта
│   │   │   └── DeleteUserDialog.test.tsx
│   │   ├── model/
│   │   │   ├── useDeleteUserMutation.ts
│   │   │   └── useRestoreUserMutation.ts
│   │   └── index.ts
│   │
│   └── admin-user-details/
│       ├── ui/
│       │   └── UserDetailsDrawer.tsx                      # Боковой Drawer с подробной информацией о пользователе
│       └── index.ts
│
├── widgets/
│   ├── admin-header/
│   │   └── ui/
│   │       └── AdminHeader.tsx                            # Заголовок раздела, хлебные крошки, кнопка "+ Добавить пользователя"
│   │
│   ├── admin-users-table/
│   │   ├── ui/
│   │   │   ├── AdminUsersTable.tsx                        # Таблица на базе @packages/ui/DataTable
│   │   │   ├── AdminUsersTableColumns.tsx                 # Описание колонок, сортировки, форматирования дат
│   │   │   ├── AdminUsersTableRowActions.tsx              # Меню действий (DropdownMenu: Просмотр, Редактировать, Сбросить пароль, Статус, Удалить/Восстановить)
│   │   │   └── AdminUsersTable.test.tsx
│   │   └── index.ts
│   │
│   └── admin-sidebar/
│       └── ui/
│           └── AdminSidebarNav.tsx                        # Навигация панели администратора
│
└── shared/
    └── config/
        └── paths.ts                                       # Маршруты paths.admin.users, paths.admin.dashboard
```

---

## 3. Детали технического дизайна UI компонентов

### 3.1. Колонки таблицы пользователей (`AdminUsersTableColumns`)
Таблица строится с помощью `DataTable` из `@packages/ui` со следующими колонками:

| Колонка | Описание | Возможность сортировки |
| :--- | :--- | :---: |
| **Пользователь** | Аватар + `displayName` + `@username` | `sortBy=username` |
| **Email** | Почтовый адрес пользователя | `sortBy=email` |
| **Роль** | Бейдж `<UserRoleBadge>` (`ADMIN` / `USER`) | `sortBy=role` |
| **Статус** | Бейдж `<UserStatusBadge>` (`Активен` / `Деактивирован` / `Удален`) | `sortBy=isActive` |
| **Дата регистрации** | Форматированная дата (`dd.MM.yyyy HH:mm`) | `sortBy=createdAt` |
| **Действия** | `<DropdownMenu>`: Детали, Редактировать, Сбросить пароль, Деактивировать/Активировать, Удалить/Восстановить | — |

---

### 3.2. Панель фильтрации (`AdminUsersFilter`)
1. **Поле поиска (`Input` с иконкой лупы):**
   - Placeholder: *"Поиск по email, имени или username..."*;
   - Поиск с задержкой (Debounce 300ms);
   - Автоматический сброс страницы на `page: 1` при изменении поисковой строки.
2. **Селектор роли (`Select`):**
   - Опции: *Все роли*, *USER*, *ADMIN*.
3. **Селектор активности (`Select`):**
   - Опции: *Все статусы*, *Только активные*, *Только деактивированные*.
4. **Селектор удаления (`Select` / `Tabs`):**
   - Опции: *Все пользователи*, *Только действующие* (`isDeleted=false`), *Только удаленные* (`isDeleted=true`).
5. **Сортировка:**
   - Выбор поля и направления через клик по заголовкам колонок таблицы.
6. **Сброс фильтров:**
   - Кнопка "Сбросить", возвращающая значения по умолчанию.
7. **URL State Synchronization:**
   - Все параметры (`page`, `limit`, `search`, `role`, `isActive`, `isDeleted`, `sortBy`, `sortOrder`) синхронизируются с `URLSearchParams` через Next.js Router (`useSearchParams`, `useRouter`).

---

### 3.3. Модальные окна и формы

#### 1. Модалка создания (`CreateUserDialog`):
- **Поля:** `email` (input), `role` (select: USER/ADMIN), `username` (input), `displayName` (input).
- **Zero-Knowledge Парольная политика:** Поле пароля **отсутствует**. Администратор не придумывает пароль; сервер генерирует временный пароль и отправляет его пользователю на почту.
- **Валидация:** Zod-схема (`createUserAdminSchema` из `@packages/dto`).
- **После сохранения:** закрытие диалога, всплывающий toast "Пользователь успешно создан. Временный пароль отправлен на email", инвалидация кэша списка.

#### 2. Модалка редактирования (`EditUserDialog`):
- **Поля:** `email`, `role`, `username`, `displayName`, `telegramUsername`, `gitUrl`.
- **Особенность:** поле пароля **отсутствует**.
- **Self-Role Guard:** Если редактируется собственный аккаунт администратора (`currentUserId === user.id`), селектор роли отключен (`disabled`) с подсказкой *"Нельзя изменить собственную роль"*.
- **Инвалидация:** при смене роли пользователю сбрасываются сессии (информирование админа в Toast).

#### 3. Диалог сброса пароля (`ResetPasswordDialog`):
- Предупреждение: *"Вы уверены, что хотите сбросить пароль для {email}? Пользователю будет сгенерирован новый временный пароль и отправлен на email, а все текущие сессии будут завершены."*
- Вызывает `POST /api/v1/admin/users/:id/reset-password`.

#### 4. Диалог деактивации (`ToggleStatusDialog`):
- Предупреждение: *"Вы уверены, что хотите деактивировать пользователя {email}? Все его активные сессии будут немедленно завершены, и он потеряет доступ к платформе."*
- **Self-Lockout защита:** Если текущий авторизованный администратор (`currentUserId === targetUserId`), кнопка деактивации в интерфейсе блокируется (`disabled`) с тултипом *"Нельзя деактивировать собственный аккаунт администратора"*.

#### 5. Диалог удаления и восстановления (`DeleteUserDialog` / `RestoreUserDialog`):
- Удаление: мягкое удаление (`DELETE /api/v1/admin/users/:id`), кнопка заблокирована для собственного аккаунта.
- Восстановление: сброс `deletedAt` и повторная активация (`POST /api/v1/admin/users/:id/restore`).

---

## 4. Чеклист реализации

### 📦 Часть 1: Слой данных и TanStack Query (`entities/admin-user`)

- [ ] **API Клиент (`entities/admin-user/api/admin-users.api.ts`):**
  - Метод `getAdminUsers(params: AdminUsersQueryParams): Promise<PaginatedResponse<UserAdminDto>>`.
  - Метод `getAdminUserById(id: string): Promise<UserAdminResponseDto>`.
  - Метод `createAdminUser(data: CreateUserAdminDto): Promise<UserAdminResponseDto>`.
  - Метод `updateAdminUser(id: string, data: UpdateUserAdminDto): Promise<UserAdminResponseDto>`.
  - Метод `toggleAdminUserStatus(id: string, isActive: boolean): Promise<UserAdminResponseDto>`.
  - Метод `resetAdminUserPassword(id: string): Promise<{ message: string }>`.
  - Метод `deleteAdminUser(id: string): Promise<{ message: string }>`.
  - Метод `restoreAdminUser(id: string): Promise<UserAdminResponseDto>`.
- [ ] **TanStack Query хуки (`entities/admin-user/api/admin-users.queries.ts`):**
  - Хук `useAdminUsers(params)` с поддержкой `keepPreviousData: true`.
  - Мутации: `useCreateAdminUserMutation`, `useUpdateAdminUserMutation`, `useToggleAdminUserStatusMutation`, `useResetPasswordMutation`, `useDeleteAdminUserMutation`, `useRestoreAdminUserMutation`.
  - Инвалидация ключа запроса `['admin', 'users']` при любых мутациях.
- [ ] **UI-компоненты сущности (`entities/admin-user/ui/`):**
  - `UserRoleBadge`: фиолетовый для `ADMIN`, нейтральный серый для `USER`.
  - `UserStatusBadge`: зеленый для `Активен`, красный для `Деактивирован`, серый для `Удален`.
  - `UserAvatarCell`: аватар с fallback инициалами, имя и юзернейм.

---

### 🔍 Часть 2: Панель фильтрации и поиска (`features/admin-users-filter`)

- [ ] **Хук синхронизации с URL (`useAdminUsersFilterState`):**
  - Чтение и запись параметров в URL search query (`search`, `role`, `isActive`, `isDeleted`, `page`, `limit`, `sortBy`, `sortOrder`).
- [ ] **Компонент фильтров (`AdminUsersFilter.tsx`):**
  - Debounced Input (300ms) для поиска по подстроке.
  - Select-фильтры по роли, активности и статусу удаления `isDeleted`.
  - Кнопка сброса при наличии активных фильтров.
  - Unit-тесты `AdminUsersFilter.test.tsx`.

---

### 📊 Часть 3: Таблица пользователей и пагинация (`widgets/admin-users-table`)

- [ ] **Колонки и рендер (`AdminUsersTableColumns.tsx`):**
  - Форматирование дат, поддержка сортировки по колонкам.
- [ ] **Меню действий строки (`AdminUsersTableRowActions.tsx`):**
  - Меню: Детали, Редактировать, Сбросить пароль, Деактивировать/Активировать, Удалить/Восстановить.
  - Блокировка деактивации, смены роли и удаления для текущего пользователя (`currentUserId === row.id`).
- [ ] **Таблица (`AdminUsersTable.tsx`):**
  - Использование `DataTable` из `@packages/ui`.
  - Состояния: Skeleton-загрузка, Empty-стейт.
  - Пагинация с выбором страниц и размера (`10, 20, 50, 100`).

---

### 🪟 Часть 4: Модальные окна действий (`features/admin-user-*`)

- [ ] **Создание пользователя (`features/admin-user-create`):**
  - Модалка `CreateUserDialog` с формой `react-hook-form` + Zod (БЕЗ пароля).
  - Toast-уведомление об отправке временного пароля на почту.
- [ ] **Редактирование пользователя (`features/admin-user-edit`):**
  - Модалка `EditUserDialog` с предзаполнением данных и блокировкой смены собственной роли.
- [ ] **Сброс пароля (`features/admin-user-reset-password`):**
  - Модалка `ResetPasswordDialog` с вызовом API сброса пароля.
- [ ] **Управление статусом (`features/admin-user-status`):**
  - Модалка подтверждения `ToggleStatusDialog` с защитой от самодеактивации.
- [ ] **Удаление и восстановление (`features/admin-user-lifecycle`):**
  - Модалки `DeleteUserDialog` и `RestoreUserDialog`.
- [ ] **Просмотр детальной информации (`features/admin-user-details`):**
  - Боковой `UserDetailsDrawer`.

---

### 🧭 Часть 5: Сборка страницы и лейаута (`app/(protected)/admin`)

- [ ] **Админский лейаут (`app/(protected)/admin/layout.tsx`):**
  - Обертка `<RoleBoundary allowedRoles={[UserRole.ADMIN]}>`.
- [ ] **Страница пользователей (`app/(protected)/admin/users/page.tsx`):**
  - Размещение `AdminHeader`, `AdminUsersFilter` и `AdminUsersTable`.

---

### 🧪 Часть 6: Тестирование (Vitest & Playwright E2E)

- [ ] **Unit & Component тесты (Vitest):**
  - `AdminUsersTable`, `AdminUsersFilter`, `CreateUserDialog`, `ToggleStatusDialog`, `DeleteUserDialog`.
- [ ] **E2E тесты (Playwright):**
  - Полный сценарий управления пользователями в браузере.

---

## 5. Критерии приемки (Definition of Done)

1. Страница `/admin/users` доступна только администраторам (`ADMIN`).
2. Таблица пользователей поддерживает серверную пагинацию, сортировку и фильтрацию (включая `isDeleted`).
3. Поиск работает с debounce (300ms) и обновляет URL-параметры страницы.
4. Создание пользователя работает по принципу Zero-Knowledge (без ручного ввода пароля).
5. Присутствует возможность сброса пароля пользователя сервером.
6. Действуют защитные блокировки от модификации собственной роли, самодеактивации и самоудаления администратора.
7. Поддерживается мягкое удаление и последующее восстановление аккаунтов.
8. Все мутации сопровождаются Toast-уведомлениями и автоматической инвалидацией кэша TanStack Query.
9. Все unit- и e2e-тесты проходят без ошибок.
