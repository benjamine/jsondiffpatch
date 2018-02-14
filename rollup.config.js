import fs from 'fs';
import path from 'path';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import istanbul from 'rollup-plugin-istanbul';
import pkg from './package.json';
import Visualizer from 'rollup-plugin-visualizer';

export default [
  {
    // browser-friendly UMD build
    input: 'src/main.js',
    external: [
      // external node modules
      'chalk',
      // 'diff-match-patch'
    ],
    output: {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
    },
    plugins: [
      replace({ 'process.browser': true }),
      babel({
        exclude: 'node_modules/**',
        plugins: ['external-helpers'],
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  },

  {
    // browser-friendly UMD build, slim (no diff-match-patch, no formatters)
    input: 'src/main.js',
    external: [
      // external node modules
      'chalk',
      'diff-match-patch',
    ],
    output: {
      name: pkg.name,
      file: pkg.browser.replace('.js', '.slim.js'),
      format: 'umd',
    },
    plugins: [
      new Visualizer({
        filename: pkg.browser.replace('.js', '.slim.stats.html'),
      }),
      replace({ 'process.browser': true }),
      babel({
        exclude: 'node_modules/**',
        plugins: ['external-helpers'],
      }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
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
        plugins: ['external-helpers'],
      }),
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
      copySrcFileToDist('index.d.ts'),
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

  {
    // build that runs tests
    input: 'test/index.js',
    external: [
      // external node modules
      'chalk',
      'diff-match-patch',
    ],
    plugins: [
      babel({
        exclude: 'node_modules/**',
        plugins: ['external-helpers'],
      }),
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
    ],
    output: {
      name: pkg.name + '-test',
      file: pkg.main.replace('.js', '.test.js'),
      format: 'cjs',
      sourcemap: true,
    },
  },
  {
    // browser-friendly UMD build that runs tests
    input: 'test/index.js',
    external: [
      // external node modules
      'chalk',
      // 'diff-match-patch'
    ],
    plugins: [
      babel({
        exclude: 'node_modules/**',
        plugins: ['external-helpers'],
      }),
      istanbul({
        include: ['src/**/*.js', 'src/formatters/*.js'],
        exclude: ['test/**/*.js', 'node_modules/**'],
      }),
      replace({ 'process.browser': true }),
      resolve(), // so Rollup can find node modules
      commonjs(), // so Rollup can convert node modules to ES modules
    ],
    output: {
      name: pkg.name + '-test',
      file: pkg.browser.replace('.js', '.test.js'),
      sourcemap: true,
      format: 'umd',
    },
  },
];

function copySrcFileToDist(filename) {
  let executed = false;
  return {
    ongenerate: () => {
      if (executed) {
        return;
      }
      fs.writeFileSync(
        path.join(__dirname, 'dist', filename),
        fs.readFileSync(path.join(__dirname, 'src', filename)),
      );
      console.log(`src/${filename} → dist/${filename} (copied)`);
      executed = true;
    },
  };
}
