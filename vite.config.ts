import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
// strictPort: a second `npm run dev` stops with "Port 3016 is already in use" instead of starting on the next port
// while the browser keeps talking to the older server (and its possibly stale list of public/ files).
export default defineConfig({root:path('./web'),publicDir:path('./public'),plugins:[react()],resolve:{alias:{'@':path('./')}},css:{postcss:{plugins:[tailwindcss()]}},server:{strictPort:true,watch:{usePolling:true}},build:{outDir:path('./dist'),emptyOutDir:true}});
