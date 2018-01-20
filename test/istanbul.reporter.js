const instanbul = require('istanbul');
const MochaSpecReporter = require('mocha/lib/reporters/spec');

module.exports = function(runner) {
  const collector = new instanbul.Collector();
  const reporter = new instanbul.Reporter();
  reporter.addAll(['lcov', 'json']);
  // eslint-disable-next-line no-new
  new MochaSpecReporter(runner);

  runner.on('end', function() {
    collector.add(global.__coverage__);

    reporter.write(collector, true, function() {
      process.stdout.write('report generated');
    });
  });
};
