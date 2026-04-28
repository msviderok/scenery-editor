import { createFileRoute } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorApp } from "@/components/editor/EditorApp";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return (
    <TooltipProvider>
      <EditorApp />
    </TooltipProvider>
  );
}
