# План реализации: счётчики слотов в «Моих анкетах»

## 1. `MyCardItem.tsx` (EDIT)
- [ ] Импорт `useTranslation('showcase')`
- [ ] Посчитать `freeCount` и `bookedCount` по `card.slots`
- [ ] Добавить бейджи `t('slots.freeCount', {count: freeCount})`, `t('slots.bookedCount', {count: bookedCount})`
- [ ] Сохранить существующий переход к редактированию

## 2. Тесты
- [ ] Unit-тест на корректные счётчики

## 3. Проверки
- [ ] tsc без ошибок
- [ ] i18n ключи
