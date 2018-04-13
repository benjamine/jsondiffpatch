import {
  createModuleBuild,
  createTestBuild,
  createBrowserTestBuild,
  createBrowserUmdEs5BuildConfig,
} from './rollup-config-factory';

let outputDir = 'build';
let includeTestCoverage = true;

export default [
  createModuleBuild(outputDir, includeTestCoverage),
  createTestBuild(outputDir, includeTestCoverage),
  createBrowserTestBuild(outputDir, includeTestCoverage),
  createBrowserUmdEs5BuildConfig(),
];
