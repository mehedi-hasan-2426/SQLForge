import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { createHash } from "node:crypto";
import vercel from "./vercel.json";

function localOfflineCache(): Plugin {
  return {
    name: "local-offline-cache",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = [...new Set(["./", "index.html", ...Object.keys(bundle), "favicon.svg", "manifest.webmanifest"])];
      const version = createHash("sha256").update(JSON.stringify(files)).digest("hex").slice(0, 12);
      const cacheWorker = `const CACHE_NAME = "sqlforge-${version}";
const FILES = __FILES__;
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(FILES.map((file) => new Request(new URL(file, self.registration.scope), { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("sqlforge-") && key !== CACHE_NAME)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request))
          ?? (await cache.match(new URL("index.html", self.registration.scope)))
          ?? Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const precached = FILES.some((file) => new URL(file, self.registration.scope).href === request.url);
    const cached = await cache.match(request, { ignoreVary: precached });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});`;
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: cacheWorker.replace("__FILES__", JSON.stringify(files))
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), localOfflineCache()],
  preview: {
    host: "127.0.0.1",
    headers: Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]))
  }
});
