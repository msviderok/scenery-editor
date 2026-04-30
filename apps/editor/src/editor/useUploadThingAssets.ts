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

  const deleteAsset = useCallback(
    async (key: string) => {
      setDeletingKeys((current) => new Set(current).add(key));
      setError(null);

      try {
        const response = await fetch("/api/uploadthing/files", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete UploadThing asset (${response.status}).`);
        }

        setAssets((current) => current.filter((asset) => asset.key !== key));
        await refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete asset.");
      } finally {
        setDeletingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [refresh],
  );

  return { assets, refresh, deleteAsset, deletingKeys, loading, error };
}
