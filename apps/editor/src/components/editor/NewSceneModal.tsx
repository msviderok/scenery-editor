import { SCENE_PRESETS } from "@/editor/constants";
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
        width: Math.max(64, Number(customWidth) || 1280),
        height: Math.max(64, Number(customHeight) || 720),
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
      className="absolute inset-0 z-[80] grid place-items-center bg-black/78 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[min(420px,calc(100vw-32px))] border border-white/22 bg-[#1a1a1a] p-6 shadow-[4px_4px_0_#000]">
        <div className="mb-5 font-[var(--font-ui)] text-[22px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
          New Scene
        </div>

        <label className="mb-4 flex flex-col gap-1.5">
          <span className="sb-label">Name</span>
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
            className="sb-input h-11 px-3"
          />
        </label>

        <div className="mb-2 sb-label">Size Preset</div>
        <div className="grid grid-cols-2 gap-2">
          {SCENE_PRESETS.map((preset, index) => {
            const active = !customMode && index === presetIndex;
            return (
              <button
                key={`${preset.width}x${preset.height}`}
                type="button"
                className={`sb-choice ${active ? "sb-choice-active" : ""}`}
                onClick={() => {
                  setCustomMode(false);
                  setPresetIndex(index);
                }}
              >
                {formatPreset(preset)}
              </button>
            );
          })}

          <button
            type="button"
            className={`sb-choice ${customMode ? "sb-choice-active" : ""}`}
            onClick={() => setCustomMode(true)}
          >
            Custom…
          </button>
        </div>

        {customMode ? (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="sb-label">Width</span>
              <input
                type="number"
                min={64}
                value={customWidth}
                onChange={(event) => setCustomWidth(Number(event.currentTarget.value) || 64)}
                className="sb-input h-10 px-3"
              />
            </label>
            <span className="pb-2 font-mono text-[13px] text-white/45">×</span>
            <label className="flex flex-col gap-1.5">
              <span className="sb-label">Height</span>
              <input
                type="number"
                min={64}
                value={customHeight}
                onChange={(event) => setCustomHeight(Number(event.currentTarget.value) || 64)}
                className="sb-input h-10 px-3"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="sb-button sb-button-muted" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sb-button sb-button-accent" onClick={submit}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
