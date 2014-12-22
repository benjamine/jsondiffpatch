module.exports.isBrowser = function() {
  try {
    // process may not be defined in browser environments
    return process.browser;
  } catch (e) {
    return true;
  }
};