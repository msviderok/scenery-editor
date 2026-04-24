import type * as React from "react";
import { useEffect } from "react";
import { AUTOSAVE_DELAY_MS, SPRITES_MANIFEST_ROUTE } from "./constants";
import { readImageSize } from "./assets";
import { createPersistedPayload, writePersistedPayload } from "./persistence";
import type { EditorDispatch, EditorState, FolderSpriteSource } from "./types";

type EditorEffectsOptions = {
  state: EditorState;
  dispatch: EditorDispatch;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
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
    folderSpriteSizeCacheRef,
    autosaveTimerRef,
    pendingPersistencePayloadRef,
    nextPersistenceSlotRef,
    restoredWorkspaceScrollRef,
  } = options;

  useEffect(() => {
    let cancelled = false;

    const fetchFolderSprites = async () => {
      try {
        const response = await fetch(SPRITES_MANIFEST_ROUTE, { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            dispatch({ type: "setFolderSprites", folderSprites: [] });
          }
          return;
        }

        const sprites = (await response.json()) as FolderSpriteSource[];
        if (cancelled) return;
        dispatch({ type: "setFolderSprites", folderSprites: sprites });

        for (const sprite of sprites) {
          if (folderSpriteSizeCacheRef.current.has(sprite.url)) continue;
          void readImageSize(sprite.url)
            .then((size) => {
              folderSpriteSizeCacheRef.current.set(sprite.url, size);
            })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: "setFolderSprites", folderSprites: [] });
        }
      }
    };

    void fetchFolderSprites();
    const timer = window.setInterval(() => {
      void fetchFolderSprites();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dispatch, folderSpriteSizeCacheRef]);

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
