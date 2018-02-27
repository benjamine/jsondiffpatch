import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createTestBuild,
  createBrowserTestBuild
} from './rollup-config-factory';

export default [
  createBrowserUmdBuildConfig(),
  createSlimBrowserUmdBuildConfig(),
  createModuleBuild(),
  createBrowserTestBuild(),
];
