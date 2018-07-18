import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import istanbul from 'rollup-plugin-istanbul';
import pkg from './package.json';
import Visualizer from 'rollup-plugin-visualizer';

/**
 * browser-friendly UMD build
 * @param {string} dirName Output destination directory
 */
export function createBrowserUmdBuildConfig(dirName = 'dist') {
  const external = [
    'turbocolor',
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
        plugins: ['external-helpers'],
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
    'turbocolor',
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
      new Visualizer({
        filename: pkg.browser
          .replace('.js', '.slim.stats.html')
          .replace(/^dist\//, `${dirName}/`),
      }),
      createEmptyModuleDist(),
      replace({ 'process.browser': true }),
      babel({
        exclude: 'node_modules/**',
        plugins: ['external-helpers'],
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
  let plugins = [
    babel({
      exclude: 'node_modules/**',
      plugins: ['external-helpers'],
    }),
  ];
  if (includeCoverage) {
    plugins.push(
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      })
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
      'turbocolor',
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
  let plugins = [
    babel({
      exclude: 'node_modules/**',
      plugins: ['external-helpers'],
    }),
  ];
  if (includeCoverage) {
    plugins.push(
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      })
    );
  }

  return {
    input: 'test/index.js',
    external: [
      // external node modules
      'turbocolor',
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
  includeCoverage = false
) => {
  let plugins = [
    babel({
      exclude: 'node_modules/**',
      plugins: ['external-helpers'],
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
      })
    );
  }

  return {
    input: 'test/index.js',
    external: [
      // external node modules
      'turbocolor',
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
        'turbocolor': 'turbocolor',
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
      ongenerate: () => {
        if (executed) {
          return;
        }
        const distFilename = path.join(__dirname, 'dist', filename);
        mkdirp(path.dirname(distFilename));
        fs.writeFileSync(
          distFilename,
          fs.readFileSync(path.join(__dirname, folder, filename))
        );
        console.log(`${folder}/${filename} → dist/${filename} (copied)`);
        executed = true;
      },
    };
  };
}

function createEmptyModuleDist() {
  return function() {
    let executed = false;
    return {
      ongenerate: () => {
        if (executed) {
          return;
        }
        const distFilename = path.join(__dirname, 'dist', 'empty.js');
        mkdirp(path.dirname(distFilename));
        fs.writeFileSync(distFilename, '');
        console.log(`dist/empty.js (created)`);
        executed = true;
      },
    };
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
