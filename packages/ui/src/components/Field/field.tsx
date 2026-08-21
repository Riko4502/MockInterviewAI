"use client";

import { useId } from "react";
import { Input } from "../Input";
import { cn } from "@lib/utils";

interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
}

function Field({ label, error, className, ...inputProps }: FieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className={cn(
          "text-xs font-semibold uppercase mb-2",
          "text-[#8A8A93]",
        )}
      >
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

export { Field, type FieldProps };
