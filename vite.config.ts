import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins:[svelte()],
  // The canonical fallback stays embedded even when imported from public assets.
  build:{assetsInlineLimit:file=>file.replaceAll('\\','/').endsWith('/public/minecraft.png')?true:undefined},
  optimizeDeps:{include:['marked','dompurify']},
  server:{port:1420,strictPort:true},
  clearScreen:false,
});
