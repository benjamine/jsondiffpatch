import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createTestBuild,
  createBrowserTestBuild
} from './rollupConfigFactory';

var outputDir = "build";
var includeTestCoverage = true;

export default [
  createModuleBuild(outputDir, includeTestCoverage),
  createTestBuild(outputDir, includeTestCoverage),
  createBrowserTestBuild(outputDir, includeTestCoverage),
];
