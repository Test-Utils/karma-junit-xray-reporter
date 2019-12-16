var os = require('os');
var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');


var JUnitXrayReporter = function (baseReporterDecorator, config, logger, helper, formatError) {
  var log = logger.create('reporter.junitxray');
  var reporterConfig = config.junitXrayReporter || {};
  var pkgName = reporterConfig.suite || '';
  var outputFile = helper.normalizeWinPath(path.resolve(config.basePath, reporterConfig.outputFile
      || 'test-results.xml'));
  let metadataFile = helper.normalizeWinPath(path.resolve(config.basePath, reporterConfig.metadataFile
    || 'metadata.json'));  

  var xml;
  var suites;
  var pendingFileWritings = 0;
  var fileWritingFinished = function() {};
  var allMessages = [];

  baseReporterDecorator(this);

  this.adapters = [function(msg) {
    allMessages.push(msg);
  }];

  var initliazeXmlForBrowser = function(browser) {
    var timestamp = (new Date()).toISOString().substr(0, 19);
    var suite = suites[browser.id] = xml.ele('testsuite', {
      name: browser.name, 'package': pkgName, timestamp: timestamp, id: 0, hostname: os.hostname()
    });
  };

  this.onRunStart = function (browsers) {
    // Create metadata file and write it on the disk
    let buildVCSNumber = '';

    log.debug('START: CHECKING TEAMCITY VAR');
    log.debug('JSON.stringify(this): \n' + JSON.stringify(this));
    log.debug('JSON.stringify(process.env): ' + JSON.stringify(process.env));
    log.debug('END: CHECKING TEAMCITY VAR');

    if (process.env.buildVersion && process.env.buildVersion != 'undefined') {
      buildVCSNumber = process.env.buildVersion; 
    }
    log.debug('buildVCSNumber: ' + buildVCSNumber);
    let metadata = {
      summary: 'Karma UI Component Tests',
      buildVCSNumber: buildVCSNumber
    }
    fs.writeFileSync(metadataFile, JSON.stringify(metadata), (err) => {
      if (err) {
        log.error('Unable to write metadataFile: ' + metadataFile + ' with data: ' + metadata);
        throw err;
      }
      log.info('Written metadataFile: ' + metadataFile);
    });
    // Creating testsuites for output junit xml file
    suites = Object.create(null);
    xml = builder.create('testsuites');
  };

  this.onBrowserStart = function (browser) {
    initliazeXmlForBrowser(browser);
  };

  this.onBrowserComplete = function (browser) {
    var suite = suites[browser.id];

    if (!suite) {
      // This browser did not signal `onBrowserStart`. That happens
      // if the browser timed out duging the start phase.
      return;
    }

    var result = browser.lastResult;

    suite.att('tests', result.total);
    suite.att('errors', result.disconnected || result.error ? 1 : 0);
    suite.att('failures', result.failed);
    suite.att('time', (result.netTime || 0) / 1000);
  };

  this.onRunComplete = function () {
    var xmlToOutput = xml;

    pendingFileWritings++;
    helper.mkdirIfNotExists(path.dirname(outputFile), function() {
      fs.writeFile(outputFile, xmlToOutput.end({pretty: true}), function(err) {
        if (err) {
          log.warn('Cannot write JUnit xml\n\t' + err.message);
        } else {
          log.debug('JUnit results written to "%s".', outputFile);
        }   
        if (!--pendingFileWritings) {
          fileWritingFinished();
        }
      });
    });

    suites = xml = null;
    allMessages.length = 0;
  };

  this.specSuccess = this.specFailure = function(browser, result) {
    let isXray = false,
        tags = result.description && result.description.split(':', 3),
        xrayId = '';
    if (tags && (tags.length > 1)) {
        xrayId = tags[1];

      if (xrayId.indexOf('XRAY') > -1) {
        isXray = true;
      }
    }

    // Component tests are being identified by xrayId tag (e.g XRAY-123) present in the desc
    // If the tag is not found then no processing needed
    if (!isXray) {
      if (reporterConfig.xrayIdOnly === true) return;
      const NOT_DEFINED = 'Not defined';
      xrayId = NOT_DEFINED;
      tags = ['', NOT_DEFINED, result.description]
      // return;
    }

    console.log('isXray: ' + isXray + '| XRAY id tag: ' + xrayId);
    const describeValue = result.suite.join(' ').replace(/\./g, '_');
    var spec = suites[browser.id].ele('testcase', {
      requirements: xrayId,
      name: tags[2].trim(),
      time: ((result.time || 0) / 1000),
      classname: describeValue
    });
    
    if (!result.success) {
      result.log.forEach(function (err) {
        spec.ele('failure', { type: '' }, formatError(err));
      });
    }
  };

  // wait for writing all the xml files, before exiting
  this.onExit = function (done) {
    if (pendingFileWritings) {
      fileWritingFinished = done;
    } else {
      done();
  }
  };
};

JUnitXrayReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
  'reporter:junitxray': ['type', JUnitXrayReporter]
};
