import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "SchedNautix",
  slug: "schednautix",
  identifier: "com.schednautix.app",
  version: "0.1.0",
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "dist",
  bindings: "src/mygo.ts",
  out: "build",
});
