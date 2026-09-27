"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const LOCAL_STORAGE_SYNC_EVENT = "local-storage-sync";

export interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  syncTabs?: boolean;
}

/**
 * Хук для реактивной работы с `localStorage` с поддержкой:
 * - SSR (безопасное выполнение без `window`);
 * - Синхронизации между компонентами текущей вкладки через CustomEvent;
 * - Синхронизации между вкладками браузера через событие `storage`;
 * - Функциональных обновлений состояния (`setValue(prev => !prev)`);
 * - Кастомных сериализаторов/десериализаторов.
 *
 * @param key - Ключ в localStorage.
 * @param initialValue - Начальное значение или фабрика значения.
 * @param options - Дополнительные параметры (сериализатор, десериализатор, синхронизация).
 * @returns Кортеж `[storedValue, setValue, removeValue]`.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  options: UseLocalStorageOptions<T> = {},
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncTabs = true,
  } = options;

  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const getInitialValue = useCallback((): T => {
    return initialValueRef.current instanceof Function
      ? initialValueRef.current()
      : initialValueRef.current;
  }, []);

  const readValue = useCallback((): T => {
    if (typeof window === "undefined") {
      return getInitialValue();
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return deserializer(item);
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Ошибка чтения ключа "${key}":`, error);
    }

    return getInitialValue();
  }, [key, deserializer, getInitialValue]);

  const [storedValue, setStoredValue] = useState<T>(getInitialValue);

  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      if (typeof window === "undefined") {
        console.warn(
          `[useLocalStorage] Попытка записи ключа "${key}" на сервере.`,
        );
        return;
      }

      try {
        const valueToStore =
          value instanceof Function
            ? (value as (prev: T) => T)(storedValueRef.current)
            : value;

        window.localStorage.setItem(key, serializer(valueToStore));
        storedValueRef.current = valueToStore;
        setStoredValue(valueToStore);

        window.dispatchEvent(
          new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
            detail: { key, value: valueToStore },
          }),
        );
      } catch (error) {
        console.warn(`[useLocalStorage] Ошибка записи ключа "${key}":`, error);
      }
    },
    [key, serializer],
  );

  const removeValue = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(key);
      const fallbackValue = getInitialValue();
      storedValueRef.current = fallbackValue;
      setStoredValue(fallbackValue);

      window.dispatchEvent(
        new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
          detail: { key, value: fallbackValue },
        }),
      );
    } catch (error) {
      console.warn(`[useLocalStorage] Ошибка удаления ключа "${key}":`, error);
    }
  }, [key, getInitialValue]);

  // Синхронизация при изменении ключа
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  // Слушатель событий текущей вкладки (CustomEvent) и других вкладок (StorageEvent)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        setStoredValue(readValue());
      }
    };

    const handleLocalSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ key: string; value: unknown }>;
      if (customEvent.detail?.key === key) {
        setStoredValue(readValue());
      }
    };

    if (syncTabs) {
      window.addEventListener("storage", handleStorageChange);
    }
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync);

    return () => {
      if (syncTabs) {
        window.removeEventListener("storage", handleStorageChange);
      }
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync);
    };
  }, [key, readValue, syncTabs]);

  return [storedValue, setValue, removeValue];
}
