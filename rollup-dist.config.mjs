import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createBrowserTestBuild,
} from './rollup-config-factory.mjs';

export default [
  createBrowserUmdBuildConfig(),
  createSlimBrowserUmdBuildConfig(),
  createModuleBuild(),
  createBrowserTestBuild(),
];
