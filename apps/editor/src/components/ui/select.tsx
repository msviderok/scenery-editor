import { cn } from "@/lib/utils";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

export const Select = SelectPrimitive.Root;

export function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...rest}
    />
  );
}

export function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...rest}
    />
  );
}

export function SelectTrigger(
  props: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: "sm" | "default";
  },
) {
  const { className, size = "default", children, ...rest } = props;
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-base border-2 border-border bg-main gap-2 px-3 py-2 text-sm font-base text-main-foreground ring-offset-white placeholder:text-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus:outline-hidden focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...rest}
    >
      {children}
      <SelectPrimitive.Icon className="pointer-events-none text-muted-foreground">
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent(
  props: React.ComponentProps<typeof SelectPrimitive.Popup> &
    Pick<
      React.ComponentProps<typeof SelectPrimitive.Positioner>,
      "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
    > & {
      container?: React.ComponentProps<typeof SelectPrimitive.Portal>["container"];
    },
) {
  const {
    className,
    children,
    container,
    side = "bottom",
    sideOffset = 4,
    align = "center",
    alignOffset = 0,
    alignItemWithTrigger = true,
    ...rest
  } = props;

  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-70"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative z-50 max-h-96 min-w-32 overflow-hidden rounded-base border-2 border-border bg-main text-main-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)",
            // position === "popper" &&
            //   "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className,
          )}
          {...rest}
        >
          <SelectScrollUpButton />
          {children}
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel(props: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...rest}
    />
  );
}

export function SelectItem(props: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const { className, children, ...rest } = props;
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex items-center justify-center">
        <Check />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator(props: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border/50", className)}
      {...rest}
    />
  );
}

export function SelectScrollUpButton(
  props: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>,
) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default text-main-foreground font-base items-center justify-center py-1",
        className,
      )}
      {...rest}
    >
      <ChevronUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

export function SelectScrollDownButton(
  props: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>,
) {
  const { className, ...rest } = props;
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default text-main-foreground font-base items-center justify-center py-1",
        className,
      )}
      {...rest}
    >
      <ChevronDown />
    </SelectPrimitive.ScrollDownArrow>
  );
}
