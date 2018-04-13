import {
  createBrowserUmdBuildConfig,
  createSlimBrowserUmdBuildConfig,
  createModuleBuild,
  createBrowserTestBuild,
  createBrowserUmdEs5BuildConfig,
} from './rollup-config-factory';

export default [
  createBrowserUmdBuildConfig(),
  createSlimBrowserUmdBuildConfig(),
  createBrowserUmdEs5BuildConfig(),
  createModuleBuild(),
  createBrowserTestBuild(),
];
