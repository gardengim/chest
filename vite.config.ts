import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte()],optimizeDeps:{include:['marked','dompurify']},server:{port:1420,strictPort:true},clearScreen:false});
