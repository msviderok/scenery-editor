import { Popover as PopoverPrimitive } from "@msviderok/base-ui-solid/popover";
import { mergeProps, splitProps, type JSX } from "solid-js";

export function PopoverRoot(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />;
}

export function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger {...props} />;
}

export function PopoverContent(
  props: PopoverPrimitive.Popup.Props &
    Pick<
      PopoverPrimitive.Positioner.Props,
      | "align"
      | "alignOffset"
      | "side"
      | "sideOffset"
      | "positionMethod"
      | "collisionBoundary"
      | "collisionPadding"
      | "sticky"
      | "trackAnchor"
      | "collisionAvoidance"
    > & {
      class?: string;
    }
) {
  const merged = mergeProps(
    {
      align: "center" as const,
      alignOffset: 0,
      side: "bottom" as const,
      sideOffset: 8,
      positionMethod: "absolute" as const,
    },
    props
  );
  const [local, rest] = splitProps(merged, [
    "align",
    "alignOffset",
    "side",
    "sideOffset",
    "positionMethod",
    "collisionBoundary",
    "collisionPadding",
    "sticky",
    "trackAnchor",
    "collisionAvoidance",
    "class",
  ]);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={local.align}
        alignOffset={local.alignOffset}
        side={local.side}
        sideOffset={local.sideOffset}
        positionMethod={local.positionMethod}
        collisionBoundary={local.collisionBoundary}
        collisionPadding={local.collisionPadding}
        sticky={local.sticky}
        trackAnchor={local.trackAnchor}
        collisionAvoidance={local.collisionAvoidance}
        class="z-60"
      >
        <PopoverPrimitive.Popup
          class={`w-60 rounded-xl border border-white/10 bg-[rgba(18,15,13,0.72)] p-3 shadow-[0_28px_60px_rgba(0,0,0,0.52)] backdrop-blur-xl ${
            local.class || ""
          }`}
          {...rest}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export function PopoverSection(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={local.class ? `flex flex-col gap-2 ${local.class}` : "flex flex-col gap-2"}
      {...rest}
    />
  );
}
