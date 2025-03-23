#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import * as consoleFormatter from '../lib/formatters/console.js';
import * as jsondiffpatch from '../lib/with-text-diffs.js';

const fileLeft = process.argv[2];
const fileRight = process.argv[3];

if (!fileLeft || !fileRight) {
  console.log(
    'usage: jsondiffpatch left.json right.json' +
      '\n' +
      '\n  note: http and https URLs are also supported\n',
  );
} else {
  Promise.all([fileLeft, fileRight].map(getJson)).then(([left, right]) => {
    const delta = jsondiffpatch.diff(left, right);
    consoleFormatter.log(delta);
  });
}

function getJson(path) {
  if (/^https?:\/\//i.test(path)) {
    // an absolute URL, fetch it
    return fetch(path).then((response) => response.json());
  }
  return JSON.parse(readFileSync(path));
}
