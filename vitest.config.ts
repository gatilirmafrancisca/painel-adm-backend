import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        // Um Mongo em memória por arquivo: os arquivos não rodam em paralelo.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 120_000,
    },
});
