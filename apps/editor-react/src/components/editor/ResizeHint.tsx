type ResizeHintProps = {
  visible: boolean;
  shiftHeld: boolean;
};

export function ResizeHint(props: ResizeHintProps) {
  if (!props.visible) return null;

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70 shadow-md backdrop-blur">
      {props.shiftHeld ? "Free-form resize" : "Hold Shift — free-form resize"}
    </div>
  );
}
