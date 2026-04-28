import { cn } from "@/lib/utils";
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import type { ComponentProps } from "react";
import { z } from "zod";

type EditorNumberFieldProps = Omit<
  ComponentProps<typeof NumberFieldPrimitive.Input>,
  "className" | "defaultValue" | "onChange" | "type" | "value"
> & {
  className?: string;
  integer?: boolean;
  maxValue?: number;
  minValue?: number;
  onValueChange: (value: number) => void;
  step?: number | "any";
  value: number;
};

function buildValidationSchema({
  integer,
  minValue,
  maxValue,
}: Pick<EditorNumberFieldProps, "integer" | "maxValue" | "minValue">) {
  const normalizedSchema = z
    .number()
    .finite()
    .transform((value) => {
      const roundedValue = integer ? Math.round(value) : value;
      let nextValue = roundedValue;
      if (typeof minValue === "number") {
        nextValue = Math.max(minValue, nextValue);
      }
      if (typeof maxValue === "number") {
        nextValue = Math.min(maxValue, nextValue);
      }
      return nextValue;
    });

  let constrainedSchema = z.number().finite();
  if (integer) {
    constrainedSchema = constrainedSchema.int();
  }
  if (typeof minValue === "number") {
    constrainedSchema = constrainedSchema.min(minValue);
  }
  if (typeof maxValue === "number") {
    constrainedSchema = constrainedSchema.max(maxValue);
  }

  return normalizedSchema.pipe(constrainedSchema);
}

export function NumberField(props: EditorNumberFieldProps) {
  const {
    className,
    value,
    onValueChange,
    minValue,
    maxValue,
    integer = false,
    id,
    step = 1,
    ...inputProps
  } = props;

  const validationSchema = buildValidationSchema({ integer, minValue, maxValue });

  return (
    <NumberFieldPrimitive.Root
      id={id}
      value={value}
      min={minValue}
      max={maxValue}
      step={integer ? 1 : step}
      allowOutOfRange
      className="contents"
      onValueCommitted={(nextValue) => {
        const parsed = validationSchema.safeParse(nextValue ?? value);
        onValueChange(parsed.success ? parsed.data : value);
      }}
    >
      <NumberFieldPrimitive.Input
        {...inputProps}
        className={cn(
          "border border-white/14 bg-white/3 text-foreground outline-none [font-variant-numeric:tabular-nums] focus:border-accent focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
          className,
        )}
      />
    </NumberFieldPrimitive.Root>
  );
}
