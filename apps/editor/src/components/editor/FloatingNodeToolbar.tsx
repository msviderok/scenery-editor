import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";
import { hasAnyCollision, type SpriteNode } from "../../../../../shared/ast";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function CollisionIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      className={props.className}
      aria-hidden="true"
    >
      <rect x="2.25" y="5.25" width="3.5" height="5.5" rx="1" />
      <rect x="9" y="3" width="4.75" height="10" rx="1.5" />
      <path d="M7.75 8h1.5" />
      <path d="M8.5 7.25v1.5" />
      <path d="M7.97 7.47l1.06 1.06" />
      <path d="M9.03 7.47L7.97 8.53" />
    </svg>
  );
}

type FloatingNodeToolbarProps = {
  node: SpriteNode | null;
  toolbarPosition: { left: number; top: number } | null;
  onUpdateNode: (nodeId: string, updater: (node: SpriteNode) => void) => void;
  onDuplicateNode: (nodeId: string) => void;
  onBringForward: (nodeId: string) => void;
  onSendBackward: (nodeId: string) => void;
  onDeleteSelected: () => void;
};

type ToolbarAction = {
  label: string;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  icon: ReactNode;
};

function ToolbarButton(props: ToolbarAction) {
  const { label, onClick, active = false, destructive = false, icon } = props;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            aria-pressed={active || undefined}
            className={`grid h-6 w-6 place-items-center border border-white/12 bg-[#232323] text-white/58 transition-colors hover:border-white/22 hover:text-white ${
              active
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,#232323)] text-[var(--accent)]"
                : ""
            } ${destructive ? "hover:border-[#e76464] hover:text-[#e76464]" : ""}`}
            onClick={onClick}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function FloatingNodeToolbar(props: FloatingNodeToolbarProps) {
  const {
    node,
    toolbarPosition,
    onUpdateNode,
    onDuplicateNode,
    onBringForward,
    onSendBackward,
    onDeleteSelected,
  } = props;

  const [showCollisionMenu, setShowCollisionMenu] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowCollisionMenu(false);
  }, [node?.id]);

  useEffect(() => {
    if (!showCollisionMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setShowCollisionMenu(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showCollisionMenu]);

  if (!node || !toolbarPosition) return null;

  const collisionEnabled = hasAnyCollision(node.collisions);

  const actions: ToolbarAction[] = [
    {
      label: node.locked ? "Unlock" : "Lock",
      active: node.locked,
      onClick: () =>
        onUpdateNode(node.id, (draft) => {
          draft.locked = !draft.locked;
        }),
      icon: node.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />,
    },
    {
      label: "Toggle collision",
      active: collisionEnabled,
      onClick: () => setShowCollisionMenu((current) => !current),
      icon: <CollisionIcon className="h-3.5 w-3.5" />,
    },
    {
      label: "Flip horizontal",
      active: node.flipH,
      onClick: () =>
        onUpdateNode(node.id, (draft) => {
          draft.flipH = !draft.flipH;
        }),
      icon: <span className="font-mono text-[10px] font-bold">H</span>,
    },
    {
      label: "Flip vertical",
      active: node.flipV,
      onClick: () =>
        onUpdateNode(node.id, (draft) => {
          draft.flipV = !draft.flipV;
        }),
      icon: <span className="font-mono text-[10px] font-bold">V</span>,
    },
    {
      label: "Bring forward",
      onClick: () => onBringForward(node.id),
      icon: <ArrowUpToLine className="h-3.5 w-3.5" />,
    },
    {
      label: "Send backward",
      onClick: () => onSendBackward(node.id),
      icon: <ArrowDownToLine className="h-3.5 w-3.5" />,
    },
    {
      label: "Duplicate",
      onClick: () => onDuplicateNode(node.id),
      icon: <Copy className="h-3.5 w-3.5" />,
    },
    {
      label: "Delete",
      destructive: true,
      onClick: onDeleteSelected,
      icon: <Trash2 className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-0.5 border border-white/12 bg-[#1f1f1f] p-[3px] shadow-[3px_3px_0_#000]"
      style={{
        left: `${toolbarPosition.left}px`,
        top: `${toolbarPosition.top}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        if (action.label !== "Toggle collision") {
          return <ToolbarButton key={action.label} {...action} />;
        }

        return (
          <div key={action.label} className="relative">
            <ToolbarButton {...action} active={action.active || showCollisionMenu} />

            {showCollisionMenu ? (
              <div className="absolute bottom-[calc(100%+6px)] left-0 z-10 flex items-center gap-0.5 border border-white/12 bg-[#1f1f1f] p-[3px] shadow-[3px_3px_0_#000]">
                {(
                  [
                    ["top", "Top collision", ArrowUpToLine],
                    ["left", "Left collision", ArrowLeftToLine],
                    ["bottom", "Bottom collision", ArrowDownToLine],
                    ["right", "Right collision", ArrowRightToLine],
                  ] as const
                ).map(([side, label, Icon]) => (
                  <ToolbarButton
                    key={side}
                    label={label}
                    active={node.collisions[side]}
                    onClick={() =>
                      onUpdateNode(node.id, (draft) => {
                        draft.collisions[side] = !draft.collisions[side];
                      })
                    }
                    icon={<Icon className="h-3 w-3" />}
                  />
                ))}
                <ToolbarButton
                  label={collisionEnabled ? "Disable all collisions" : "Enable all collisions"}
                  active={collisionEnabled}
                  onClick={() =>
                    onUpdateNode(node.id, (draft) => {
                      const next = !hasAnyCollision(draft.collisions);
                      draft.collisions.top = next;
                      draft.collisions.right = next;
                      draft.collisions.bottom = next;
                      draft.collisions.left = next;
                    })
                  }
                  icon={<CollisionIcon className="h-3 w-3" />}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
