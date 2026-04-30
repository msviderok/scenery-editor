import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { defineConfig } from "vite-plus";
import type { Plugin } from "vite-plus";
import { nitro } from "nitro/vite";

const START_SERVER_ENVIRONMENT_NAME = "ssr";
const START_SERVER_ENTRY = "virtual:tanstack-start-server-entry";

function tanstackStartVitePlusDevMiddleware(): Plugin {
  return {
    name: "tanstack-start-vite-plus-dev-middleware",
    configureServer(viteDevServer) {
      return () => {
        viteDevServer.middlewares.use(async (req, res) => {
          const serverEnv = viteDevServer.environments[START_SERVER_ENVIRONMENT_NAME] as
            | {
                dispatchFetch?: (request: Request) => Promise<Response>;
                runner?: {
                  import: (
                    id: string,
                  ) => Promise<{ default: { fetch: (request: Request) => Promise<Response> } }>;
                };
              }
            | undefined;

          if (!serverEnv) {
            res.statusCode = 500;
            res.end(
              `TanStack Start server environment "${START_SERVER_ENVIRONMENT_NAME}" not found.`,
            );
            return;
          }

          if (req.originalUrl) {
            req.url = req.originalUrl;
          }

          const webReq = new NodeRequest({ req, res });

          try {
            let webRes: Response;
            if (typeof serverEnv.dispatchFetch === "function") {
              webRes = await serverEnv.dispatchFetch(webReq);
            } else if (serverEnv.runner) {
              const serverEntry = await serverEnv.runner.import(START_SERVER_ENTRY);
              webRes = await serverEntry.default.fetch(webReq);
            } else {
              res.statusCode = 500;
              res.end("TanStack Start server environment does not support request dispatch.");
              return;
            }

            await sendNodeResponse(res, webRes);
          } catch (error) {
            viteDevServer.ssrFixStacktrace(error as Error);
            console.error(error);
            await sendNodeResponse(
              res,
              new Response(
                `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><pre>${error instanceof Error ? error.message : String(error)}</pre></body></html>`,
                {
                  status: 500,
                  headers: {
                    "Content-Type": "text/html; charset=utf-8",
                  },
                },
              ),
            );
          }
        });
      };
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      vite: {
        installDevServerMiddleware: false,
      },
    }),
    tanstackStartVitePlusDevMiddleware(),
    nitro({ preset: "vercel" }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
