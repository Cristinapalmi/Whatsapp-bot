import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false, // os testes de base de dados partilham a mesma BD de teste
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@config": path.resolve(__dirname, "config"),
    },
  },
});
