"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority"
import { cn } from "@lib/utils"

const formLabelVariants = cva(
  "inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-[#8A8A93] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  {
    variants: {},
    defaultVariants: {},
  }
)

// --------------- FormItem context ---------------

type FormItemContextValue = { id: string }

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

// --------------- FormItem ---------------

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

// --------------- useFormItem ---------------

function useFormItem() {
  const ctx = React.useContext(FormItemContext)

  if (!ctx) {
    throw new Error("FormItem sub-components must be used within <FormItem>")
  }

  return ctx
}

// --------------- FormLabel ---------------

const FormLabel = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { id } = useFormItem()

  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(formLabelVariants({ className }), "mb-2")}
      htmlFor={id}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

// --------------- FormControl ---------------

const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { id } = useFormItem()

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

// --------------- FormMessage ---------------

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const body = children

  if (!body) {
    return <div ref={ref} className={cn("min-h-[1lh]", className)} />
  }

  return (
    <p
      ref={ref}
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useFormItem,
}
