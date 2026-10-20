# План реализации: счётчики слотов в «Моих анкетах»

## 1. `MyCardItem.tsx` (EDIT)
- [x] Импорт `useTranslation('showcase')`
- [x] Посчитать `freeCount` (OPEN && `startsAt > now()`) и `bookedCount` (BOOKED) по `card.slots`
- [x] Добавить бейджи `t('slots.freeCount', {count: freeCount})`, `t('slots.bookedCount', {count: bookedCount})`
- [x] Сохранить существующий переход к редактированию

## 2. Тесты
- [x] Unit-тест на корректные счётчики

## 3. Проверки
- [x] tsc без ошибок
- [x] i18n ключи
