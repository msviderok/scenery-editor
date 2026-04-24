import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "text-main-foreground bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        noShadow: "text-main-foreground bg-main border-2 border-border",
        neutral:
          "bg-secondary-background text-foreground border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        reverse:
          "text-main-foreground bg-main border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow",
        outline:
          "bg-transparent text-foreground border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        ghost:
          "bg-transparent text-foreground border border-transparent hover:bg-secondary-background/70",
        destructive:
          "bg-red-500 text-white border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    focusableWhenDisabled?: boolean;
    nativeButton?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "default",
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

export { Button, buttonVariants };
