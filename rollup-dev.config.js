import fs from 'fs';
import path from 'path';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import istanbul from 'rollup-plugin-istanbul';
import pkg from './package.json';
import Visualizer from 'rollup-plugin-visualizer';

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
