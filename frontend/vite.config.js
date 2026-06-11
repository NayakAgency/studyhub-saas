import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 9000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.warn'],
        passes: 3,
        unsafe: true,
        unsafe_arrows: true,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
        },
      },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Charts — largest lib, isolated for optimal loading
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            // Animation
            if (id.includes('framer-motion')) return 'motion';
            // Editor — isolated
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
            // Lightbox / crop / image
            if (id.includes('yet-another-react-lightbox') || id.includes('react-easy-crop') || id.includes('html-to-image')) return 'media';
            // Icons
            if (id.includes('lucide-react')) return 'icons';
            // Everything else vendor (includes react, router, query, zustand, etc.)
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/[hash:16].js',
        entryFileNames: 'assets/[hash:16].js',
        assetFileNames: 'assets/[hash:16].[ext]',
      },
    },
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
}));
