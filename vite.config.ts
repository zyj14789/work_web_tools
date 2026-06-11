import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { build as esbuildBuild } from 'esbuild';

function contentScriptIIFE(): Plugin {
  let outDir = 'dist';

  return {
    name: 'content-script-iife',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async writeBundle() {
      const contentResult = await esbuildBuild({
        entryPoints: [resolve(__dirname, 'interface/content/index.ts')],
        bundle: true,
        format: 'iife',
        outfile: resolve(__dirname, outDir, 'content.js'),
        target: 'es2020',
        platform: 'browser',
        minify: false,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
        alias: {
          '@app': resolve(__dirname, 'app'),
          '@interface': resolve(__dirname, 'interface'),
          '@gui': resolve(__dirname, 'gui'),
        },
        tsconfig: resolve(__dirname, 'tsconfig.json'),
        loader: { '.ts': 'ts', '.tsx': 'tsx' },
      });

      if (contentResult.errors.length > 0) {
        throw new Error(`content script build failed: ${contentResult.errors[0].text}`);
      }

      const hookResult = await esbuildBuild({
        entryPoints: [resolve(__dirname, 'interface/content/network-hook.ts')],
        bundle: true,
        format: 'iife',
        outfile: resolve(__dirname, outDir, 'network-hook.js'),
        target: 'es2020',
        platform: 'browser',
        minify: false,
        tsconfig: resolve(__dirname, 'tsconfig.json'),
        loader: { '.ts': 'ts' },
      });

      if (hookResult.errors.length > 0) {
        throw new Error(`network hook build failed: ${hookResult.errors[0].text}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), contentScriptIIFE()],
  resolve: {
    alias: {
      '@app': resolve(__dirname, 'app'),
      '@interface': resolve(__dirname, 'interface'),
      '@gui': resolve(__dirname, 'gui'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'interface/background/index.ts'),
        popup: resolve(__dirname, 'gui/popup/index.html'),
        sidepanel: resolve(__dirname, 'gui/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    modulePreload: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
