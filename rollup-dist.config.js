import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createBrowserTestBuild,
} from './rollup-config-factory';

export default [
  createBrowserUmdBuildConfig(),
  createSlimBrowserUmdBuildConfig(),
  createModuleBuild(),
  createBrowserTestBuild(),
];
