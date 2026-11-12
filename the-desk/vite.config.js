import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// `vite build --mode static` builds a backend-free version (offline agents run in the browser).
export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';
  return {
    root: 'web',
    base: isStatic ? './' : '/',
    plugins: [react()],
    define: isStatic ? { 'process.env.MOCK_SPEED': '"2"', 'import.meta.env.VITE_STATIC': 'true' } : {},
    resolve: {
      alias: isStatic
        ? [
            { find: 'desk-api', replacement: r('./web/src/static/api.js') },
            { find: /^node:fs$/, replacement: r('./web/src/static/node-fs.js') },
            { find: /^node:path$/, replacement: r('./web/src/static/node-path.js') },
            { find: /.*\/llm\.js$/, replacement: r('./web/src/static/llm.js') },
          ]
        : [{ find: 'desk-api', replacement: r('./web/src/static/none.js') }],
    },
    build: { outDir: isStatic ? '../dist-static' : '../dist', emptyOutDir: true },
    server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } }, fs: { allow: ['..'] } },
  };
});
