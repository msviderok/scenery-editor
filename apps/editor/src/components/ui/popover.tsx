import { cn } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

export function PopoverRoot(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />;
}

export function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger {...props} />;
}

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof PopoverPrimitive.Popup> &
    Pick<
      React.ComponentProps<typeof PopoverPrimitive.Positioner>,
      | "align"
      | "alignOffset"
      | "side"
      | "sideOffset"
      | "positionMethod"
      | "collisionBoundary"
      | "collisionPadding"
      | "sticky"
      | "collisionAvoidance"
    > & {
      container?: React.ComponentProps<typeof PopoverPrimitive.Portal>["container"];
    }
>(function PopoverContent(props, ref) {
  const {
    align = "center",
    alignOffset = 0,
    side = "bottom",
    sideOffset = 4,
    positionMethod = "absolute",
    collisionBoundary,
    collisionPadding,
    sticky,
    collisionAvoidance,
    className,
    container,
    ...rest
  } = props;

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        positionMethod={positionMethod}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        sticky={sticky}
        collisionAvoidance={collisionAvoidance}
        className="z-60"
      >
        <PopoverPrimitive.Popup
          ref={ref}
          className={cn(
            "z-50 w-72 rounded-base border-2 border-border bg-main p-4 text-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin)",
            className,
          )}
          {...rest}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
});

export function PopoverSection(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn("flex flex-col gap-2", className)} {...rest} />;
}
