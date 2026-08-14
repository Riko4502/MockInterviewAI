# Stack

## Назначение

`Stack` — базовый layout-компонент проекта **MockInterviewAI** для позиционирования элементов с помощью `display: flex`.

Цель компонента:

- унифицировать использование flex-layout
- сократить повторение Tailwind-классов
- предоставить типизированный API для основных flex-свойств
- использовать единый набор значений `gap`

---

## Расположение в проекте

```text
shared/ui/Stack
```

Компонент относится к слою `shared/ui` и не содержит бизнес-логики.

---

## Принцип использования

Вместо повторения flex-классов:

```tsx
<div className="flex flex-col items-center gap-4">
  {children}
</div>
```

используется:

```tsx
<Stack direction="column" align="center" gap="16">
  {children}
</Stack>
```

`Stack` преобразует переданные props в соответствующие Tailwind-классы.

---

## Props

### direction

Определяет направление элементов.

```ts
type StackDirection = "row" | "column";
```

Значение по умолчанию:

```text
row
```

Пример:

```tsx
<Stack direction="column">
  {children}
</Stack>
```

---

### justify

Определяет расположение элементов по основной оси.

Доступные значения:

```ts
type StackJustify =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around";
```

Соответствие Tailwind:

```text
start    → justify-start
center   → justify-center
end      → justify-end
between  → justify-between
around   → justify-around
```

Значение по умолчанию:

```text
start
```

---

### align

Определяет расположение элементов по поперечной оси.

```ts
type StackAlign =
  | "start"
  | "center"
  | "end"
  | "stretch";
```

Соответствие Tailwind:

```text
start    → items-start
center   → items-center
end      → items-end
stretch  → items-stretch
```

Значение по умолчанию:

```text
start
```

---

### gap

Определяет расстояние между элементами.

Доступные значения:

```ts
type StackGap =
  | "4"
  | "8"
  | "16"
  | "24"
  | "32"
  | "48"
  | "64";
```

Соответствие Tailwind:

```text
4   → gap-1   → 4px
8   → gap-2   → 8px
16  → gap-4   → 16px
24  → gap-6   → 24px
32  → gap-8   → 32px
48  → gap-12  → 48px
64  → gap-16  → 64px
```

Пример:

```tsx
<Stack gap="16">
  {children}
</Stack>
```

---

### wrap

Включает перенос элементов на следующую строку.

```tsx
<Stack wrap>
  {children}
</Stack>
```

Соответствует:

```text
flex-wrap
```

---

### max

Растягивает контейнер на всю доступную ширину.

```tsx
<Stack max>
  {children}
</Stack>
```

Соответствует:

```text
w-full
```

---

### tag

Позволяет выбрать семантический HTML-тег контейнера.

Доступные значения:

```ts
type StackTag =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "main"
  | "nav"
  | "header";
```

По умолчанию:

```text
div
```

Пример:

```tsx
<Stack tag="section" direction="column" gap="24">
  {children}
</Stack>
```

`tag` используется только для выбора подходящего контейнерного HTML-элемента.

`Stack` не предназначен для интерактивных элементов (`button`, `a` и т. п.).

---

### className

Позволяет добавить дополнительные Tailwind-классы:

```tsx
<Stack
  direction="column"
  gap="16"
  className="p-6"
>
  {children}
</Stack>
```

Внутренние классы `Stack` и переданный `className` объединяются через `clsx`.

---

## Примеры

### Вертикальный Stack

```tsx
<Stack direction="column" gap="16">
  <Title />
  <Description />
</Stack>
```

### Горизонтальное расположение

```tsx
<Stack align="center" gap="8">
  <Avatar />
  <UserName />
</Stack>
```

### Элементы по краям контейнера

```tsx
<Stack justify="between" align="center" max>
  <Logo />
  <Navigation />
</Stack>
```

### Семантическая секция

```tsx
<Stack
  tag="section"
  direction="column"
  gap="24"
  max
>
  {children}
</Stack>
```

---

## Когда использовать Stack

`Stack` используется для типовых flex-layout:

- горизонтальное расположение элементов
- вертикальное расположение элементов
- управление `gap`
- `justify-content`
- `align-items`
- `flex-wrap`
- построение простых layout-композиций

---

## Когда НЕ использовать Stack

Не использовать `Stack`:

- как замену любому HTML-элементу
- для интерактивных элементов
- если требуется CSS Grid
- если layout требует сложного специфичного CSS
- если `display: flex` не нужен

Для простого элемента без flex-layout:

```tsx
<div className="p-4">
  {children}
</div>
```

создавать `Stack` не требуется.

---

## Ограничения и правила

- `Stack` всегда является flex-контейнером.
- Компонент не содержит бизнес-логики.
- Не добавлять в `Stack` props, относящиеся к конкретной feature.
- Не использовать `Stack` как универсальный polymorphic-компонент.
- Набор `gap` ограничен значениями, определёнными API компонента.
- Для дополнительной стилизации использовать `className`.
- Для CSS Grid использовать отдельное layout-решение.
- Изменение API `Stack` учитывать как изменение общего `shared/ui`.