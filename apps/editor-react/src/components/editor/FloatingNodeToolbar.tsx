import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";
import { hasAnyCollision, type SpriteNode } from "../../../../../shared/ast";
import { Button } from "@/components/ui/button";
import { PopoverContent, PopoverRoot, PopoverSection, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  selectedUnlockedNodeIds: string[];
  nodeStyleId: string | null;
  collisionEditorId: string | null;
  stylePopoverContentRef: React.RefObject<HTMLDivElement | null>;
  onSetNodeStyleOpen: (open: boolean, nodeId: string) => void;
  onSetCollisionEditorOpen: (open: boolean, nodeId: string) => void;
  onUpdateNode: (nodeId: string, updater: (node: SpriteNode) => void) => void;
  onDeleteSelected: () => void;
};

export function FloatingNodeToolbar(props: FloatingNodeToolbarProps) {
  const {
    node,
    toolbarPosition,
    selectedUnlockedNodeIds,
    nodeStyleId,
    collisionEditorId,
    stylePopoverContentRef,
    onSetNodeStyleOpen,
    onSetCollisionEditorOpen,
    onUpdateNode,
    onDeleteSelected,
  } = props;

  if (!node || !toolbarPosition) return null;

  return (
    <div
      className="absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border border-white/10 bg-[rgba(18,15,13,0.78)] p-[3px] shadow-[0_14px_36px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      style={{
        left: `${toolbarPosition.left}px`,
        top: `${toolbarPosition.top}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <PopoverRoot open={nodeStyleId === node.id} onOpenChange={(open) => onSetNodeStyleOpen(open, node.id)}>
        <PopoverTrigger className="rounded-full border border-transparent bg-transparent px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:border-white/10 hover:bg-white/8 hover:text-white/90">
          Style
        </PopoverTrigger>
        <PopoverContent
          ref={stylePopoverContentRef}
          side="top"
          collisionPadding={12}
          sticky
          className="w-auto min-w-0"
        >
          <PopoverSection className="gap-1.5 p-2">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-[10px]">
              <span className="uppercase tracking-[0.12em] text-white/40">Size</span>
              <input
                className="w-24 rounded border border-white/8 bg-white/5 px-1.5 py-1 text-[11px] text-white outline-none focus:border-white/16"
                value={node.style.backgroundSize ?? "100% 100%"}
                onChange={(event) => {
                  const value = event.currentTarget.value.trim();
                  onUpdateNode(node.id, (draft) => {
                    if (value) draft.style.backgroundSize = value;
                    else delete draft.style.backgroundSize;
                  });
                }}
              />
              <span className="uppercase tracking-[0.12em] text-white/40">Repeat</span>
              <Select
                value={node.style.backgroundRepeat ?? "no-repeat"}
                onValueChange={(value) =>
                  onUpdateNode(node.id, (draft) => {
                    draft.style.backgroundRepeat = String(value);
                  })
                }
              >
                <SelectTrigger size="sm" className="w-24 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent container={stylePopoverContentRef.current ?? undefined}>
                  <SelectItem value="no-repeat">no-repeat</SelectItem>
                  <SelectItem value="repeat">repeat</SelectItem>
                  <SelectItem value="repeat-x">repeat-x</SelectItem>
                  <SelectItem value="repeat-y">repeat-y</SelectItem>
                  <SelectItem value="space">space</SelectItem>
                  <SelectItem value="round">round</SelectItem>
                </SelectContent>
              </Select>
              <span className="uppercase tracking-[0.12em] text-white/40">Position</span>
              <input
                className="w-24 rounded border border-white/8 bg-white/5 px-1.5 py-1 text-[11px] text-white outline-none focus:border-white/16"
                value={node.style.backgroundPosition ?? "center"}
                onChange={(event) => {
                  const value = event.currentTarget.value.trim();
                  onUpdateNode(node.id, (draft) => {
                    if (value) draft.style.backgroundPosition = value;
                    else delete draft.style.backgroundPosition;
                  });
                }}
              />
              <span className="uppercase tracking-[0.12em] text-white/40">Opacity</span>
              <input
                className="w-24 rounded border border-white/8 bg-white/5 px-1.5 py-1 text-[11px] text-white outline-none focus:border-white/16"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={node.opacity}
                onChange={(event) =>
                  onUpdateNode(node.id, (draft) => {
                    draft.opacity = Math.min(1, Math.max(0, Number(event.currentTarget.value) || 0));
                  })
                }
              />
            </div>
          </PopoverSection>
        </PopoverContent>
      </PopoverRoot>

      <PopoverRoot
        open={collisionEditorId === node.id}
        onOpenChange={(open) => onSetCollisionEditorOpen(open, node.id)}
      >
        <PopoverTrigger
          className="grid h-6 w-6 place-items-center rounded-md border border-transparent bg-transparent text-white/60 transition-all outline-none hover:bg-white/8 hover:text-white/90 focus-visible:border-white/12 focus-visible:ring-2 focus-visible:ring-white/15 aria-[expanded=true]:bg-white/8 aria-[expanded=true]:text-white/90 aria-[pressed=true]:border-amber-300/40 aria-[pressed=true]:bg-amber-300/15 aria-[pressed=true]:text-[#ffd58a]"
          aria-pressed={hasAnyCollision(node.collisions)}
          title="Collision sides"
        >
          <CollisionIcon className="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent side="top" collisionPadding={12} sticky className="w-auto p-[3px]">
          <div className="flex items-center gap-0.5">
            {(
              [
                ["top", "Top", ArrowUpToLine],
                ["left", "Left", ArrowLeftToLine],
                ["bottom", "Bottom", ArrowDownToLine],
                ["right", "Right", ArrowRightToLine],
              ] as const
            ).map(([side, title, Icon]) => (
              <button
                key={side}
                type="button"
                title={title}
                aria-pressed={node.collisions[side]}
                className="grid h-6 w-6 place-items-center rounded-md border border-transparent bg-transparent text-white/60 transition hover:border-white/10 hover:bg-white/8 hover:text-white/90 aria-[pressed=true]:border-amber-300/40 aria-[pressed=true]:bg-amber-300/15 aria-[pressed=true]:text-[#ffd58a]"
                onClick={() =>
                  onUpdateNode(node.id, (draft) => {
                    draft.collisions[side] = !draft.collisions[side];
                  })
                }
              >
                <Icon className="h-3 w-3" />
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            <button
              type="button"
              title={hasAnyCollision(node.collisions) ? "Disable all" : "Enable all"}
              aria-pressed={hasAnyCollision(node.collisions)}
              className="grid h-6 w-6 place-items-center rounded-md border border-transparent bg-transparent text-white/60 transition hover:border-white/10 hover:bg-white/8 hover:text-white/90 aria-[pressed=true]:border-amber-300/40 aria-[pressed=true]:bg-amber-300/15 aria-[pressed=true]:text-[#ffd58a]"
              onClick={() =>
                onUpdateNode(node.id, (draft) => {
                  const next = !hasAnyCollision(draft.collisions);
                  draft.collisions.top = next;
                  draft.collisions.right = next;
                  draft.collisions.bottom = next;
                  draft.collisions.left = next;
                })
              }
            >
              <CollisionIcon className="h-3 w-3" />
            </button>
          </div>
        </PopoverContent>
      </PopoverRoot>

      <Button
        variant={node.locked ? "default" : "ghost"}
        size="icon-sm"
        title={node.locked ? "Unlock" : "Lock"}
        onClick={() => onUpdateNode(node.id, (draft) => void (draft.locked = !draft.locked))}
      >
        {node.locked ? <Lock /> : <LockOpen />}
      </Button>
      <Button
        variant="destructive"
        size="icon-sm"
        title="Delete"
        disabled={!selectedUnlockedNodeIds.length}
        onClick={onDeleteSelected}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
