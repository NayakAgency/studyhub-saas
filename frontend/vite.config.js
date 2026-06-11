import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [
      react({
        babel: isProd ? {} : undefined,
      }),
    ],

    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },

    server: {
      port: 9000,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/ws':  { target: 'ws://localhost:3001', ws: true },
      },
    },

    build: {
      // Target modern browsers — drops legacy polyfills (~15% smaller)
      target: ['es2020', 'chrome90', 'firefox90', 'safari14'],
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console:  isProd,
          drop_debugger: true,
          pure_funcs: isProd
            ? ['console.log', 'console.info', 'console.debug', 'console.warn']
            : [],
          passes: 2,
          ecma: 2020,
        },
        mangle: { toplevel: true, properties: { regex: /^_/ } },
        format: { comments: false, ecma: 2020 },
      },
      rollupOptions: {
        output: {
          // Fine-grained code splitting for optimal caching
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            // Heavy chart lib — only load on analytics pages
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory'))
              return 'charts';
            // Animation — deferred
            if (id.includes('framer-motion'))
              return 'motion';
            // Rich-text editor — lazy-loaded on resource/announcement pages
            if (id.includes('@tiptap') || id.includes('prosemirror'))
              return 'editor';
            // Image tooling — lazy loaded
            if (
              id.includes('yet-another-react-lightbox') ||
              id.includes('react-easy-crop') ||
              id.includes('html-to-image')
            )
              return 'media';
            // Icons — large, separate cache entry
            if (id.includes('lucide-react'))
              return 'icons';
            // Form validation
            if (id.includes('zod') || id.includes('@hookform'))
              return 'forms';
            // Date utilities
            if (id.includes('date-fns'))
              return 'dates';
            // HTTP client
            if (id.includes('axios'))
              return 'http';
            // React core (very stable — long-lived cache)
            if (
              id.includes('react/') ||
              id.includes('react-dom') ||
              id.includes('scheduler')
            )
              return 'react-core';
            // React ecosystem
            if (
              id.includes('react-router') ||
              id.includes('@tanstack/react-query') ||
              id.includes('zustand')
            )
              return 'react-libs';
            // Radix UI primitives
            if (id.includes('@radix-ui'))
              return 'radix';
            // Everything else
            return 'vendor';
          },
          // Stable hash filenames → immutable cache headers
          chunkFileNames: 'assets/[name]-[hash:8].js',
          entryFileNames: 'assets/entry-[hash:8].js',
          assetFileNames: 'assets/[name]-[hash:8].[ext]',
        },
      },
      chunkSizeWarningLimit: 700,
      sourcemap: false,
      cssCodeSplit: true,
      // Inline tiny assets (<4 KB) as base64 → fewer HTTP requests
      assetsInlineLimit: 4096,
      reportCompressedSize: true,
    },

    // Pre-bundle common deps for faster cold-start HMR
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'zustand',
        'axios',
        'react-hook-form',
        'zod',
        'framer-motion',
        'lucide-react',
        'react-hot-toast',
        'date-fns',
        'clsx',
        'tailwind-merge',
      ],
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
