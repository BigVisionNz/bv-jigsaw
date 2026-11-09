// @ts-check
import cloudflare from "@astrojs/cloudflare"
import tailwindcss from "@tailwindcss/vite"
import react from "@astrojs/react"
import { defineConfig } from "astro/config"

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Catalog pages read public/puzzles with node:fs while they are prerendered.
    prerenderEnvironment: "node",
    // Puzzle art is already in public/. Do not provision a Cloudflare Images binding.
    imageService: "passthrough",
  }),
  // Progress, favourites, and custom pictures stay in the browser.
  session: false,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})