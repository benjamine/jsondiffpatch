import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { visualizer } from 'rollup-plugin-visualizer';

import pkg from './package.json' assert { type: 'json' };

const copySrcFileToDist = copyFromFolderToDist('src');
const copyDocsFileToDist = copyFromFolderToDist('docs');

export default [
  {
    input: 'src/main.js',
    external: ['chalk'],
    output: {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      globals: {
        chalk: 'chalk',
      },
      paths: {
        chalk: './empty'
      }
    },
    plugins: [
      createEmptyModuleDist(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  },
  {
    input: 'src/main.js',
    external: ['chalk', 'diff-match-patch'],
    output: {
      name: pkg.name,
      file: pkg.browser
        .replace('.js', '.slim.js'),
      format: 'umd',
      globals: {
        chalk: 'chalk',
        'diff-match-patch': 'diff-match-patch'
      },
      paths: {
        chalk: './empty',
        'diff-match-patch': './empty'
      },
    },
    plugins: [
      visualizer({
        filename: pkg.browser
          .replace('.js', '.slim.stats.html')
      }),
      createEmptyModuleDist(),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  },
  {
    input: 'src/main.js',
    external: [
      // external node modules
      'diff-match-patch',
      'chalk',
    ],
    plugins: [
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
      copySrcFileToDist('index.d.ts'),
      copyDocsFileToDist('formatters-styles/annotated.css'),
      copyDocsFileToDist('formatters-styles/html.css'),
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

function copyFromFolderToDist(folder) {
  return function(filename) {
    let executed = false;
    return {
      name: 'copy-from-folder-to-dist',
      generateBundle() {
        if (executed) {
          return;
        }
        const distFileURL = new URL(path.join('dist', filename), import.meta.url);
        fs.mkdirSync(path.dirname(fileURLToPath(distFileURL)), { recursive: true });
        fs.writeFileSync(
          distFileURL,
          fs.readFileSync(new URL(path.join(folder, filename), import.meta.url)),
        );
        console.log(`${folder}/${filename} → dist/${filename} (copied)`);
        executed = true;
      },
    };
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
      const distFileURL = new URL(path.join('dist', 'empty.js'), import.meta.url);
      fs.mkdirSync(path.dirname(fileURLToPath(distFileURL)), { recursive: true });
      fs.writeFileSync(distFileURL, '');
      console.log('dist/empty.js (created)');
      executed = true;
    },
  };
}
