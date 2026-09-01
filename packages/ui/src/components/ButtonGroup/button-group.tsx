"use client";

import { cn } from "@packages/utils";
import * as React from "react";
import { buttonGroupVariants } from "./constants";
import type { ButtonGroupContextValue, ButtonGroupProps } from "./types";

const ButtonGroupContext = React.createContext<ButtonGroupContextValue>({});

/**
 * Хук для получения параметров группы кнопок (размер, вариант, состояние disabled).
 */
export function useButtonGroupContext() {
  return React.useContext(ButtonGroupContext);
}

/**
 * Компонент группировки кнопок (ButtonGroup).
 *
 * Позволяет:
 * - Бесшовно объединять кнопки в единую горизонтальную или вертикальную панель;
 * - Автоматически прокидывать `size`, `variant` и `disabled` всем дочерним кнопкам;
 * - Создавать тулбары, переключатели сегментов и сплит-кнопки (Split buttons).
 */
function ButtonGroup({
  className,
  orientation = "horizontal",
  attached = true,
  size,
  variant,
  disabled,
  children,
  ...props
}: ButtonGroupProps) {
  const contextValue = React.useMemo(
    () => ({ size, variant, disabled }),
    [size, variant, disabled],
  );

  return (
    <ButtonGroupContext.Provider value={contextValue}>
      <div
        role="group"
        data-slot="button-group"
        data-orientation={orientation}
        data-attached={attached}
        className={cn(buttonGroupVariants({ orientation }), className)}
        {...props}
      >
        {children}
      </div>
    </ButtonGroupContext.Provider>
  );
}

export { ButtonGroup, ButtonGroupContext };
