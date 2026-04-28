import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { MIN_SCENE_SIZE, SCENE_PRESETS } from "@/editor/constants";
import { useEffect, useMemo, useState } from "react";

type SceneSize = {
  width: number;
  height: number;
};

type NewSceneModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (scene: { name: string; width: number; height: number }) => void;
};

function formatPreset(size: SceneSize) {
  return `${size.width} × ${size.height}`;
}

export function NewSceneModal(props: NewSceneModalProps) {
  const { open, onClose, onCreate } = props;
  const labelClass = "font-(--font-ui) text-[9px] uppercase tracking-[0.14em] text-white/38";
  const inputClass =
    "border border-white/14 bg-white/3 text-foreground outline-none focus:border-accent focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]";
  const activeChoiceClass =
    "border-accent text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]";

  const [name, setName] = useState("");
  const [presetIndex, setPresetIndex] = useState(1);
  const [customMode, setCustomMode] = useState(false);
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPresetIndex(1);
    setCustomMode(false);
    setCustomWidth(1280);
    setCustomHeight(720);
  }, [open]);

  const activeSize = useMemo(() => {
    if (customMode) {
      return {
        width: Math.max(MIN_SCENE_SIZE, Number(customWidth) || 1280),
        height: Math.max(MIN_SCENE_SIZE, Number(customHeight) || 720),
      };
    }

    const preset = SCENE_PRESETS[presetIndex] ?? SCENE_PRESETS[1];
    return {
      width: preset.width,
      height: preset.height,
    };
  }, [customHeight, customMode, customWidth, presetIndex]);

  if (!open) return null;

  const submit = () => {
    onCreate({
      name: name.trim() || "New Scene",
      width: activeSize.width,
      height: activeSize.height,
    });
  };

  return (
    <div
      className="absolute inset-0 z-80 grid place-items-center bg-black/78 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[min(420px,calc(100vw-32px))] border border-white/22 bg-[#1a1a1a] p-6 shadow-[4px_4px_0_#000]">
        <div className="mb-5 font-(--font-ui) text-[22px] uppercase tracking-[0.14em] text-accent">
          New Scene
        </div>

        <label className="mb-4 flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Scene name…"
            className={`${inputClass} h-11 px-3`}
          />
        </label>

        <div className={`mb-2 ${labelClass}`}>Size Preset</div>
        <div className="grid grid-cols-2 gap-2">
          {SCENE_PRESETS.map((preset, index) => {
            const active = !customMode && index === presetIndex;
            return (
              <Button
                key={`${preset.width}x${preset.height}`}
                variant="choice"
                type="button"
                className={active ? activeChoiceClass : undefined}
                onClick={() => {
                  setCustomMode(false);
                  setPresetIndex(index);
                }}
              >
                {formatPreset(preset)}
              </Button>
            );
          })}

          <Button
            variant="choice"
            type="button"
            className={customMode ? activeChoiceClass : undefined}
            onClick={() => setCustomMode(true)}
          >
            Custom…
          </Button>
        </div>

        {customMode ? (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Width</span>
              <NumberField
                integer
                minValue={MIN_SCENE_SIZE}
                value={customWidth}
                onValueChange={setCustomWidth}
                className={`${inputClass} h-10 px-3`}
              />
            </label>
            <span className="pb-2 font-mono text-[13px] text-white/45">×</span>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Height</span>
              <NumberField
                integer
                minValue={MIN_SCENE_SIZE}
                value={customHeight}
                onValueChange={setCustomHeight}
                className={`${inputClass} h-10 px-3`}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="muted" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="button" onClick={submit}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
