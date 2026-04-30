import { useCallback, useEffect, useRef, useState } from "react";
import { readImageSize } from "./assets";

export type UploadThingAsset = {
  key: string;
  name: string;
  size: number;
  status: string;
  url: string;
  width: number;
  height: number;
};

type UploadThingFileResponse = {
  key: string;
  name: string;
  size: number;
  status: string;
  url: string;
};

export function useUploadThingAssets() {
  const [assets, setAssets] = useState<UploadThingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(() => new Set());
  const sizeCacheRef = useRef(new Map<string, { width: number; height: number }>());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/uploadthing/files", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load UploadThing assets (${response.status}).`);
      }

      const files = (await response.json()) as UploadThingFileResponse[];
      const nextAssets = await Promise.all(
        files.map(async (file) => {
          const cached = sizeCacheRef.current.get(file.url);
          const size = cached ?? (await readImageSize(file.url));
          sizeCacheRef.current.set(file.url, size);

          return {
            ...file,
            width: size.width,
            height: size.height,
          };
        }),
      );

      setAssets(nextAssets.sort((left, right) => left.name.localeCompare(right.name)));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load assets.");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deleteAssets = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      setDeletingKeys((current) => {
        const next = new Set(current);
        for (const key of keys) next.add(key);
        return next;
      });
      setError(null);

      try {
        const response = await fetch("/api/uploadthing/files", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys }),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete UploadThing asset(s) (${response.status}).`);
        }

        const removeSet = new Set(keys);
        setAssets((current) => current.filter((asset) => !removeSet.has(asset.key)));
        await refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete asset(s).");
      } finally {
        setDeletingKeys((current) => {
          const next = new Set(current);
          for (const key of keys) next.delete(key);
          return next;
        });
      }
    },
    [refresh],
  );

  const deleteAsset = useCallback(
    async (key: string) => {
      await deleteAssets([key]);
    },
    [deleteAssets],
  );

  return { assets, refresh, deleteAsset, deleteAssets, deletingKeys, loading, error };
}
