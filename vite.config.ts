import { defineConfig } from 'vite'
import path from 'path'
import fs from 'node:fs/promises'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function staticHostFallback() {
  return {
    name: 'static-host-fallback',
    async writeBundle(options) {
      const outputDir = options.dir ?? path.dirname(options.file ?? 'dist/index.html')
      await fs.copyFile(path.resolve(__dirname, outputDir, 'index.html'), path.resolve(__dirname, outputDir, '404.html'))
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "./",
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    staticHostFallback(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
