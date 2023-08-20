import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import istanbul from 'rollup-plugin-istanbul';
import pkg from './package.json' assert { type: 'json' };
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * browser-friendly UMD build
 * @param {string} dirName Output destination directory
 */
export function createBrowserUmdBuildConfig(dirName = 'dist') {
  const external = [
    'chalk',
  ];
  return {
    input: 'src/main.js',
    external,
    output: {
      name: pkg.name,
      file: pkg.browser.replace(/^dist\//, `${dirName}/`),
      format: 'umd',
      ...outputExternal(external),
    },
    plugins: [
      createEmptyModuleDist(),
      replace({ 'process.browser': true }),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  };
}

/**
 * browser-friendly UMD build, slim (no diff-match-patch, no formatters)
 * @param {string} dirName Output destination directory
 */
export function createSlimBrowserUmdBuildConfig(dirName = 'dist') {
  const external = [
    'chalk',
    'diff-match-patch',
  ];
  return {
    input: 'src/main.js',
    external,
    output: {
      name: pkg.name,
      file: pkg.browser
        .replace('.js', '.slim.js')
        .replace(/^dist\//, `${dirName}/`),
      format: 'umd',
      ...outputExternal(external),
    },
    plugins: [
      visualizer({
        filename: pkg.browser
          .replace('.js', '.slim.stats.html')
          .replace(/^dist\//, `${dirName}/`),
      }),
      createEmptyModuleDist(),
      replace({ 'process.browser': true }),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  };
}

/**
 * CommonJS (for Node) and ES module (for bundlers) build.
 * @param {string} dirName Output destination directory
 * @param {boolean} includeCoverage Whether to compute test coverage
 *   and include it in outputted .js files
 */
export function createModuleBuild(dirName = 'dist', includeCoverage = false) {
  const plugins = [
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
  ];
  if (includeCoverage) {
    plugins.push(
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
    );
  }
  if (dirName === 'dist') {
    plugins.push(copySrcFileToDist('index.d.ts'));
    plugins.push(copyDocsFileToDist('formatters-styles/annotated.css'));
    plugins.push(copyDocsFileToDist('formatters-styles/html.css'));
  }

  return {
    input: 'src/main.js',
    external: [
      // external node modules
      'diff-match-patch',
      'chalk',
    ],
    plugins,
    output: [
      {
        file: pkg.main.replace(/^dist\//, `${dirName}/`),
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.module.replace(/^dist\//, `${dirName}/`),
        format: 'es',
        sourcemap: true,
      },
    ],
  };
}

/**
 * Build that runs tests
 * @param {string} dirName Output destination directory
 * @param {boolean} includeCoverage Whether to compute test coverage and
 *   include it in outputted .js files
 */
export function createTestBuild(dirName = 'dist', includeCoverage = false) {
  const plugins = [
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
  ];
  if (includeCoverage) {
    plugins.push(
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
    );
  }

  return {
    input: 'test/index.js',
    external: [
      // external node modules
      'chalk',
      'diff-match-patch',
    ],
    plugins,
    output: {
      name: pkg.name + '-test',
      file: pkg.main
        .replace('.js', '.test.js')
        .replace(/^dist\//, `${dirName}/`),
      format: 'cjs',
      sourcemap: true,
    },
  };
}

/**
 * Browser-friendly UMD build that runs tests
 * @param {string} dirName Output destination directory
 * @param {boolean} includeCoverage Whether to compute test coverage and
 *   include it in outputted .js files
 */
export const createBrowserTestBuild = (
  dirName = 'dist',
  includeCoverage = false,
) => {
  const plugins = [
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
    replace({ 'process.browser': true }),
    resolve(), // so Rollup can find node modules
    commonjs(), // so Rollup can convert node modules to ES modules
  ];
  if (includeCoverage) {
    plugins.push(
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
    );
  }

  return {
    input: 'test/index.js',
    external: [
      // external node modules
      'chalk',
      // 'diff-match-patch'
    ],
    plugins,
    output: {
      name: pkg.name + '-test',
      file: pkg.browser
        .replace('.js', '.test.js')
        .replace(/^dist\//, `${dirName}/`),
      sourcemap: true,
      format: 'umd',
      globals: {
        chalk: 'chalk',
      },
    },
  };
};

const copySrcFileToDist = copyFromFolderToDist('src');
const copyDocsFileToDist = copyFromFolderToDist('docs');

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

function outputExternal(names) {
  if (!names || names.length < 1) {
    return;
  }
  return {
    globals: names.reduce((accum, name) => ({
      ...accum,
      [name]: name,
    }), {}),
    paths: names.reduce((accum, name) => ({
      ...accum,
      [name]: './empty',
    }), {}),
  };
}
