import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

import pkg from './package.json' assert { type: 'json' };

export default [
  {
    input: 'src/main.ts',
    external: ['chalk'],
    output: {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      globals: {
        chalk: 'chalk',
      },
      paths: {
        chalk: './empty',
      },
    },
    plugins: [
      createEmptyModuleDist(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        extensions: ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts'],
      }),
      resolve(),
      commonjs(),
      typescript({ noForceEmit: true }),
    ],
  },
  {
    input: 'src/main.ts',
    external: ['chalk', 'diff-match-patch'],
    output: {
      name: pkg.name,
      file: pkg.browser.replace('.js', '.slim.js'),
      format: 'umd',
      globals: {
        chalk: 'chalk',
        'diff-match-patch': 'diff-match-patch',
      },
      paths: {
        chalk: './empty',
        'diff-match-patch': './empty',
      },
    },
    plugins: [
      visualizer({
        filename: pkg.browser.replace('.js', '.slim.stats.html'),
      }),
      createEmptyModuleDist(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        extensions: ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts'],
      }),
      resolve(),
      commonjs(),
      typescript({ noForceEmit: true }),
    ],
  },
  {
    input: 'src/main.ts',
    external: [
      // external node modules
      'diff-match-patch',
      'chalk',
    ],
    plugins: [
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        extensions: ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts'],
      }),
      typescript({
        compilerOptions: {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
        },
        noForceEmit: true,
      }),
      copyStylesToDist(),
      copyStylesToDist(),
    ],
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
      },
    ],
  },
];

function copyStylesToDist() {
  let executed = false;
  return {
    name: 'copy-from-folder-to-dist',
    generateBundle() {
      if (executed) {
        return;
      }
      const srcFolder = 'src/formatters/styles';
      const distFolder = 'dist/formatters-styles';
      fs.cpSync(srcFolder, distFolder, { recursive: true });
      console.log(`${srcFolder} → ${distFolder} (copied)`);
      executed = true;
    },
  };
}

function createEmptyModuleDist() {
  let executed = false;
  return {
    name: 'create-empty-module-dist',
    generateBundle() {
      if (executed) {
        return;
      }
      const distFileURL = new URL(
        path.join('dist', 'empty.js'),
        import.meta.url,
      );
      fs.mkdirSync(path.dirname(fileURLToPath(distFileURL)), {
        recursive: true,
      });
      fs.writeFileSync(distFileURL, '');
      console.log('dist/empty.js (created)');
      executed = true;
    },
  };
}
