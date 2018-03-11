import {
  createModuleBuild,
  createTestBuild,
  createBrowserTestBuild,
} from './rollup-config-factory';

let outputDir = 'build';
let includeTestCoverage = true;

export default [
  createModuleBuild(outputDir, includeTestCoverage),
  createTestBuild(outputDir, includeTestCoverage),
  createBrowserTestBuild(outputDir, includeTestCoverage),
];
