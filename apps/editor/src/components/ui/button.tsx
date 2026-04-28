import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const sbButtonBase =
  "inline-flex items-center justify-center gap-[0.45rem] border border-white/14 px-[0.8rem] py-[0.55rem] font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.14em] shadow-[3px_3px_0_#000] transition-colors duration-[120ms] hover:border-accent";

const buttonVariants = cva("", {
  variants: {
    variant: {
      iconButton:
        "grid h-7 w-7 place-items-center border border-white/14 bg-white/[0.03] text-white/52 transition-colors duration-[120ms] hover:border-accent hover:text-foreground",
      muted: `${sbButtonBase} bg-[#232323] text-white/80`,
      accent: `${sbButtonBase} bg-accent border-[color-mix(in_srgb,var(--accent)_55%,#000)] text-main-foreground`,
      choice:
        "flex min-h-12 items-center justify-center border border-white/14 bg-white/[0.03] font-[var(--font-mono-ui)] text-[13px] text-white/52",
    },
    size: {
      default: "",
      compact:
        "gap-[0.35rem] px-[0.7rem] py-[0.25rem] text-[10px] tracking-[0.12em] shadow-[2px_2px_0_#000]",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    focusableWhenDisabled?: boolean;
    nativeButton?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    disabled,
    focusableWhenDisabled = false,
    nativeButton = true,
    type = "button",
    tabIndex,
    onClick,
    onMouseDown,
    onPointerDown,
    onKeyDown,
    onKeyUp,
    ...props
  },
  ref,
) {
  const isDisabled = Boolean(disabled);
  const isFocusableWhenDisabled = isDisabled && focusableWhenDisabled;

  return (
    <button
      {...props}
      ref={ref}
      data-slot="button"
      aria-disabled={isDisabled || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isDisabled && !isFocusableWhenDisabled}
      tabIndex={isFocusableWhenDisabled ? (tabIndex ?? 0) : tabIndex}
      type={nativeButton ? type : undefined}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      onMouseDown={(event) => {
        if (isDisabled) return;
        onMouseDown?.(event);
      }}
      onPointerDown={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        if (isDisabled) {
          if (isFocusableWhenDisabled) event.preventDefault();
          return;
        }
        onKeyDown?.(event);
      }}
      onKeyUp={(event) => {
        if (isDisabled) {
          if (isFocusableWhenDisabled) event.preventDefault();
          return;
        }
        onKeyUp?.(event);
      }}
    />
  );
});

export { Button };
