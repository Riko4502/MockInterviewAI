"use client";

import { Input } from "@packages/ui";
import { useId } from "react";

interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
}

export function Field({ label, error, className, ...inputProps }: FieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase text-muted-foreground mb-2"
      >
        {/*
                    TODO: заменить на компонент Label пакета ui
                    цвет текста: #8A8A93 — сейчас нет в переменных темы,
                    используется text-muted-foreground как временное значение
                */}
        {label}
      </label>
      <Input
        id={id}
        data-invalid={!!error}
        aria-invalid={!!error}
        className={className}
        {...inputProps}
      />
      <div className="min-h-[1lh]">
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
