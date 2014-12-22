var environment = require('./environment');

if (environment.isBrowser) {
  /* global window */
  /* jshint camelcase: false */
  window.diff_match_patch = require('../public/external/diff_match_patch_uncompressed');
  /* jshint camelcase: true */
}

module.exports = require('./main');
