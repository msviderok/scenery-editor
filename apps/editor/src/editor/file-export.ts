import type { ComponentExportFile } from "./component-export";

type FileSystemWritableFileStream = {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
};

type FileSystemFileHandle = {
  createWritable(): Promise<FileSystemWritableFileStream>;
};

type FileSystemDirectoryHandle = {
  getFileHandle(name: string, options: { create: boolean }): Promise<FileSystemFileHandle>;
};

type DirectoryPickerWindow = typeof globalThis & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

export type ComponentExportSaveResult = {
  mode: "directory" | "download" | "cancelled";
  fileCount: number;
};

export async function saveComponentExportFiles(
  files: ComponentExportFile[],
): Promise<ComponentExportSaveResult> {
  const picker = (globalThis as DirectoryPickerWindow).showDirectoryPicker;

  if (picker) {
    try {
      const directory = await picker();

      for (const file of files) {
        const handle = await directory.getFileHandle(file.fileName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(new Blob([file.content], { type: file.mimeType }));
        await writable.close();
      }

      return { mode: "directory", fileCount: files.length };
    } catch (error) {
      if (isAbortError(error)) {
        return { mode: "cancelled", fileCount: 0 };
      }
      throw error;
    }
  }

  for (const file of files) {
    downloadFile(file);
  }

  return { mode: "download", fileCount: files.length };
}

function downloadFile(file: ComponentExportFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
