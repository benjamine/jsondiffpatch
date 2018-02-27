import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createTestBuild,
  createBrowserTestBuild
} from './rollupConfigFactory';

export default [
  createBrowserUmdBuildConfig(),
  createSlimBrowserUmdBuildConfig(),
  createModuleBuild(),
  createBrowserTestBuild(),
];
