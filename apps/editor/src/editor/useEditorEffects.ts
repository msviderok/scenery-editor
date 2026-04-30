import type * as React from "react";
import { useEffect } from "react";
import { AUTOSAVE_DELAY_MS } from "./constants";
import { createPersistedPayload, writePersistedPayload } from "./persistence";
import type { EditorDispatch, EditorState } from "./types";

type EditorEffectsOptions = {
  state: EditorState;
  dispatch: EditorDispatch;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  autosaveTimerRef: React.MutableRefObject<number | null>;
  pendingPersistencePayloadRef: React.MutableRefObject<string | null>;
  nextPersistenceSlotRef: React.MutableRefObject<0 | 1>;
  restoredWorkspaceScrollRef: React.MutableRefObject<boolean>;
};

export function useEditorEffects(options: EditorEffectsOptions) {
  const {
    state,
    dispatch,
    workspaceRef,
    autosaveTimerRef,
    pendingPersistencePayloadRef,
    nextPersistenceSlotRef,
    restoredWorkspaceScrollRef,
  } = options;

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || restoredWorkspaceScrollRef.current) return;

    const { left, top } = state.workspaceScroll;
    const frame = window.requestAnimationFrame(() => {
      workspace.scrollTo({ left, top });
      restoredWorkspaceScrollRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [state.workspaceScroll, workspaceRef, restoredWorkspaceScrollRef]);

  useEffect(() => {
    pendingPersistencePayloadRef.current = createPersistedPayload(state);

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const payload = pendingPersistencePayloadRef.current;
      if (!payload) return;

      try {
        nextPersistenceSlotRef.current = writePersistedPayload(
          window.localStorage,
          payload,
          nextPersistenceSlotRef.current,
        );
        pendingPersistencePayloadRef.current = null;
        dispatch({ type: "setPersistenceError", persistenceError: null });
      } catch (error) {
        dispatch({
          type: "setPersistenceError",
          persistenceError:
            "Autosave to localStorage failed. The current editor session may not survive a refresh until storage is freed.",
        });
        console.error("Failed to persist sprite editor state to localStorage.", error);
      }
    }, AUTOSAVE_DELAY_MS);
  }, [autosaveTimerRef, dispatch, nextPersistenceSlotRef, pendingPersistencePayloadRef, state]);

  useEffect(() => {
    const flushPersistedState = () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      const payload = pendingPersistencePayloadRef.current;
      if (!payload) return;

      try {
        nextPersistenceSlotRef.current = writePersistedPayload(
          window.localStorage,
          payload,
          nextPersistenceSlotRef.current,
        );
        pendingPersistencePayloadRef.current = null;
        dispatch({ type: "setPersistenceError", persistenceError: null });
      } catch (error) {
        dispatch({
          type: "setPersistenceError",
          persistenceError:
            "Autosave to localStorage failed. The current editor session may not survive a refresh until storage is freed.",
        });
        console.error("Failed to persist sprite editor state to localStorage.", error);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        dispatch({ type: "setShiftHeld", shiftHeld: true });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        dispatch({ type: "setShiftHeld", shiftHeld: false });
      }
    };

    const onBlur = () => {
      dispatch({ type: "setShiftHeld", shiftHeld: false });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersistedState();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", flushPersistedState);
    window.addEventListener("pagehide", flushPersistedState);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      flushPersistedState();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", flushPersistedState);
      window.removeEventListener("pagehide", flushPersistedState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [autosaveTimerRef, dispatch, nextPersistenceSlotRef, pendingPersistencePayloadRef]);
}
