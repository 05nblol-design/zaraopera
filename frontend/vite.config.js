import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Zara Operação',
        short_name: 'ZaraOp',
        description: 'Sistema de Controle de Operações Zara',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles')
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['192.168.1.149', 'chatty-humans-run.loca.lt', 'nine-hands-slide.loca.lt', 'zara-app-final.loca.lt', 'zara-app-v3.loca.lt', 'zara-frontend-stable.loca.lt', 'zara-app-stable.loca.lt', 'zara-app-v4.loca.lt', 'zara-app-final-v5.loca.lt', 'purple-flies-beam.loca.lt', 'breezy-hands-pull.loca.lt', 'zara-app-public.loca.lt', 'famous-shoes-type.loca.lt', 'chips-navy-fourth-indication.trycloudflare.com', 'leisure-music-battery-initiative.trycloudflare.com', 'objective-why-nervous-happens.trycloudflare.com', 'opponents-couples-muslim-joshua.trycloudflare.com', 'virtue-im-click-cord.trycloudflare.com', 'understanding-sequence-prep-laden.trycloudflare.com', 'dubai-patches-robert-cow.trycloudflare.com', 'moderators-broader-childhood-kind.trycloudflare.com', 'e8456a4a8585.ngrok-free.app', '1645a033ed58.ngrok-free.app', 'c1079614a8aa.ngrok-free.app', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL?.replace('/api', '') || 'http://192.168.1.149:3001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: process.env.VITE_API_URL?.replace('/api', '') || 'http://192.168.1.149:3001',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: process.env.VITE_SOCKET_URL || 'http://192.168.1.149:3001',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['chart.js', 'react-chartjs-2'],
          ui: ['@headlessui/react', '@heroicons/react'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'socket.io-client',
      'chart.js',
      'react-chartjs-2',
      'date-fns',
      'react-hook-form',
      'yup',
      'react-hot-toast',
      'framer-motion',
      '@headlessui/react',
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      'clsx',
      'tailwind-merge'
    ]
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: true
  }
});