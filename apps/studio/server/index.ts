import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { record } from "@telekinesis/engine";
import { mixAudio, toGif } from "@telekinesis/render";
import { createServer as createViteServer } from "vite";
import { alias } from "../vite.config";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const soundsDir = path.resolve(root, "..", "..", "packages", "cli", "assets", "sounds");

const { values } = parseArgs({
  options: { port: { type: "string" }, target: { type: "string" } },
  strict: false,
});
const PORT = Number(values.port ?? process.env.TK_STUDIO_PORT ?? 57174);
const TARGET = String(values.target ?? process.env.TK_STUDIO_TARGET ?? "http://localhost:4311");

async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(res: http.ServerResponse, code: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(data);
}

/** Record `timesheet` against `url` and return the requested artifact bytes. */
async function handleRender(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const { timesheet, url, format = "gif" } = await readJson(req);
  const work = await mkdtemp(path.join(tmpdir(), "tk-studio-"));
  try {
    const result = await record(timesheet, { url: url ?? TARGET, outDir: work, headless: true });
    let out: string;
    let type: string;
    if (format === "mp4") {
      out = path.join(work, "demo.mp4");
      await mixAudio({ videoPath: result.videoPath, audioMap: result.audioMap, soundsDir, output: out });
      type = "video/mp4";
    } else {
      out = path.join(work, "demo.gif");
      await toGif(result.videoPath, { output: out, fps: 15, width: 960 });
      type = "image/gif";
    }
    const bytes = await readFile(out);
    res.writeHead(200, {
      "content-type": type,
      "content-disposition": `attachment; filename="telekinesis-demo.${format}"`,
    });
    res.end(bytes);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function handleSave(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const { path: filePath, timesheet } = await readJson(req);
  if (!filePath || typeof filePath !== "string") return sendJson(res, 400, { error: "missing path" });
  try {
    await writeFile(path.resolve(filePath), `${JSON.stringify(timesheet, null, 2)}\n`, "utf8");
    sendJson(res, 200, { ok: true, path: path.resolve(filePath) });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

async function listen(server: http.Server, port: number, attemptsLeft = 20): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
        server.removeListener("error", onError);
        resolve(listen(server, port + 1, attemptsLeft - 1));
      } else reject(err);
    };
    server.once("error", onError);
    server.listen(port, () => {
      server.removeListener("error", onError);
      resolve(port);
    });
  });
}

async function main(): Promise<void> {
  const react = (await import("@vitejs/plugin-react")).default;
  const vite = await createViteServer({
    root,
    // Don't also auto-load vite.config.ts — that would apply plugin-react twice
    // (double React Refresh injection → "symbol already declared").
    configFile: false,
    plugins: [react()],
    resolve: { alias },
    define: { __TK_TARGET__: JSON.stringify(TARGET) },
    server: { middlewareMode: true },
    appType: "spa",
  });

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.startsWith("/api/config")) return sendJson(res, 200, { target: TARGET });
    if (url.startsWith("/api/render") && req.method === "POST") return void handleRender(req, res);
    if (url.startsWith("/api/save") && req.method === "POST") return void handleSave(req, res);
    vite.middlewares(req, res);
  });

  const actualPort = await listen(server, PORT);
  console.log(`\n  ◑ Telekinesis Studio`);
  console.log(`  → http://localhost:${actualPort}`);
  console.log(`  editing ${TARGET}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
