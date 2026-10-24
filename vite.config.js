import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (
            id.includes("/node_modules/react") ||
            id.includes("/node_modules/scheduler/")
          )
            return "react";
          if (
            id.includes("/node_modules/motion") ||
            id.includes("/node_modules/framer-motion/")
          )
            return "motion";
        },
      },
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        warn(warning);
      },
    },
  },
});
