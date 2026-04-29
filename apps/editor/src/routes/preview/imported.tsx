import { createFileRoute } from "@tanstack/react-router";
import { ImportedPreviewPage } from "@/components/preview/ImportedPreviewPage";

export const Route = createFileRoute("/preview/imported")({
  ssr: false,
  component: ImportedPreviewRoute,
});

function ImportedPreviewRoute() {
  return <ImportedPreviewPage />;
}
