import { Button } from "@/components/ui/button";
import {
  PopoverContent,
  PopoverRoot,
  PopoverSection,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildComponentExportFiles,
  type ComponentExportFramework,
  type ComponentExportLayout,
} from "@/editor/component-export";
import { saveComponentExportFiles } from "@/editor/file-export";
import type { SpriteProject } from "@msviderok/sprite-editor-ast-schema";
import { useState } from "react";

type ExportMenuProps = {
  project: SpriteProject;
};

type ExportStatus = {
  tone: "success" | "error" | "muted";
  message: string;
} | null;

export function ExportMenu({ project }: ExportMenuProps) {
  const [framework, setFramework] = useState<ComponentExportFramework>("solid");
  const [layout, setLayout] = useState<ComponentExportLayout>("single-file");
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<ExportStatus>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setStatus(null);

    try {
      const files = await buildComponentExportFiles(project, { framework, layout });
      const result = await saveComponentExportFiles(files);

      if (result.mode === "cancelled") {
        setStatus({ tone: "muted", message: "Export cancelled." });
      } else if (result.mode === "directory") {
        setStatus({
          tone: "success",
          message: `Saved ${result.fileCount} file${result.fileCount === 1 ? "" : "s"} to folder.`,
        });
      } else {
        setStatus({
          tone: "success",
          message: `Downloaded ${result.fileCount} file${result.fileCount === 1 ? "" : "s"}.`,
        });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to export TSX components.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PopoverRoot>
      <PopoverTrigger
        render={
          <Button variant="accent" size="compact" type="button" className="h-8 px-3">
            Export
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-none border border-white/14 bg-[#1d1d1d] p-3 shadow-[3px_3px_0_#000]"
      >
        <PopoverSection className="gap-3">
          <div>
            <div className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              Framework
            </div>
            <Select
              value={framework}
              onValueChange={(value) => setFramework(value as ComponentExportFramework)}
            >
              <SelectTrigger className="mt-1 h-8 rounded-none border-white/14 bg-[#232323] text-[11px] text-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-white/14 bg-[#232323] text-white">
                <SelectItem value="solid">SolidJS</SelectItem>
                <SelectItem value="react">React</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
              Output
            </div>
            <Select
              value={layout}
              onValueChange={(value) => setLayout(value as ComponentExportLayout)}
            >
              <SelectTrigger className="mt-1 h-8 rounded-none border-white/14 bg-[#232323] text-[11px] text-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-white/14 bg-[#232323] text-white">
                <SelectItem value="single-file">Single file</SelectItem>
                <SelectItem value="separate-files">Separate files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-2">
            <div className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/54">
              Destination
            </div>
            <div className="mt-1 font-[var(--font-mono-ui)] text-[10px] leading-4 text-white/45">
              Choose folder when supported. Other browsers will download the generated files.
            </div>
          </div>

          {status ? (
            <div
              className={
                status.tone === "error"
                  ? "border border-[#e76464]/50 bg-[#281313] px-2 py-1.5 font-mono text-[10px] text-[#f0b1b1]"
                  : status.tone === "success"
                    ? "border border-emerald-400/35 bg-emerald-950/30 px-2 py-1.5 font-mono text-[10px] text-emerald-200"
                    : "border border-white/10 bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-white/54"
              }
            >
              {status.message}
            </div>
          ) : null}

          <Button
            variant="accent"
            size="compact"
            type="button"
            className="h-8 w-full px-3"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            {isExporting ? "Exporting..." : "Export TSX"}
          </Button>
        </PopoverSection>
      </PopoverContent>
    </PopoverRoot>
  );
}
