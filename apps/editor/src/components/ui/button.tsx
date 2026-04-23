import { cva, type VariantProps } from "class-variance-authority";
import { mergeProps, splitProps, type JSX } from "solid-js";

import { cn } from "../../lib/utils";

function callEventHandler<T, E extends Event>(
  handler: JSX.EventHandlerUnion<T, E> | undefined,
  event: E & { currentTarget: T; target: Element }
) {
  if (!handler) return;
  if (typeof handler === "function") {
    handler(event);
  } else {
    handler[0](handler[1], event);
  }
}

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-xs/relaxed font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-7 gap-1 px-2 text-xs/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-5 gap-1 rounded-sm px-2 text-[0.625rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-6 gap-1 px-2 text-xs/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-8 gap-1 px-2.5 text-xs/relaxed has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-5 rounded-sm [&_svg:not([class*='size-'])]:size-2.5",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    focusableWhenDisabled?: boolean | undefined;
    nativeButton?: boolean | undefined;
  };

function Button(props: ButtonProps) {
  const mergedProps = mergeProps(
    {
      variant: "default" as const,
      size: "default" as const,
      focusableWhenDisabled: false,
      nativeButton: true,
      type: "button" as const,
    },
    props
  );

  const [local, rest] = splitProps(mergedProps, [
    "class",
    "variant",
    "size",
    "disabled",
    "focusableWhenDisabled",
    "nativeButton",
    "type",
    "tabIndex",
    "onClick",
    "onMouseDown",
    "onPointerDown",
    "onKeyDown",
    "onKeyUp",
  ]);

  const isDisabled = () => Boolean(local.disabled);
  const isFocusableWhenDisabled = () => isDisabled() && Boolean(local.focusableWhenDisabled);

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    if (isDisabled()) {
      event.preventDefault();
      return;
    }
    callEventHandler(local.onClick, event);
  };

  const handleMouseDown: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    if (!isDisabled()) {
      callEventHandler(local.onMouseDown, event);
    }
  };

  const handlePointerDown: JSX.EventHandler<HTMLButtonElement, PointerEvent> = (event) => {
    if (isDisabled()) {
      event.preventDefault();
      return;
    }
    callEventHandler(local.onPointerDown, event);
  };

  const handleKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (event) => {
    if (isDisabled()) {
      if (isFocusableWhenDisabled()) {
        event.preventDefault();
      }
      return;
    }
    callEventHandler(local.onKeyDown, event);
  };

  const handleKeyUp: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (event) => {
    if (isDisabled()) {
      if (isFocusableWhenDisabled()) {
        event.preventDefault();
      }
      return;
    }
    callEventHandler(local.onKeyUp, event);
  };

  return (
    <button
      data-slot="button"
      aria-disabled={isDisabled() || undefined}
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      disabled={isDisabled() && !isFocusableWhenDisabled()}
      tabIndex={isFocusableWhenDisabled() ? local.tabIndex ?? 0 : local.tabIndex}
      type={local.nativeButton ? local.type : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      {...rest}
    />
  );
}

export { Button, buttonVariants };
