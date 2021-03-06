'use strict';

const chai = require('chai');
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const path = require('path');
const builder = require('xmlbuilder');
const fastXmlParser = require('fast-xml-parser');

let fakeLogObject = {
  debug: noop,
  warn: noop,
  info: noop,
  error: noop
};

// Validation schema is read from a file
const testReportsPath = '_test-reports/';
console.log('TEST REPORTS PATH: ' + testReportsPath);

chai.use(require('sinon-chai'));

function noop() { }

const fakeLogger = {
  create: () => {
    return fakeLogObject
  }
};

const fakeHelper = {
  normalizeWinPath: (input) => {
    return input
  },
  mkdirIfNotExists: sinon.stub().yields()
};

const fakeFormatError = sinon.spy(function (v) {
  return v
});

const fakeConfig = {
  basePath: __dirname,
  junitXrayReporter: {
    outputFile: path.normalize(
        path.join(testReportsPath,
            'component-test-results/component_tests_' +
            new Date().toISOString().replace(/:|\./g, '_') +
            '.xml')
    ),
    suite: '',
    jiraProjectKey: 'CARE'
  }
};

// Rule of thumb:
// - If you test the new XML format, remember to (within that test) create a new fake reporter,
//   passing it also this line in the fake config: "fakeConfig.junitReporter.xmlVersion: 1"

const fakeBaseReporterDecorator = noop;

describe('JUnit reporter', function () {
  let reporterModule;
  let reporter;

  let fakeFs;
  let fakePath;

  const fakeBrowser = {
    id: 'Android_4_1_2',
    name: 'Android',
    fullName: 'Android 4.1.2',
    lastResult: {
      error: false,
      total: 1,
      failed: 0,
      netTime: 10 * 1000
    }
  };

  beforeEach(function () {
    fakeFs = {
      writeFile: sinon.spy(),
      writeFileSync: sinon.spy()
    };
    fakePath = {
      resolve: (input1, input2) => { return (input1 + input2) },
      dirname: noop
    };

    reporterModule = proxyquire('..', {
      fs: fakeFs,
      path: fakePath,
      xmlbuilder: builder
    })
  });

  beforeEach(function () {
    reporter = new reporterModule['reporter:junitxray'][1](fakeBaseReporterDecorator, fakeConfig, fakeLogger, fakeHelper, fakeFormatError)
  });

  it('should produce valid XML per the new SonarQube reporting format', function () {
    // Two differences in this test, compared to other tests:
    // a) we have a different configuration for the reporter
    // b) need a instantiation of the reporter - the beforeEach doesn't work since it is for old XML
    // Static result, since we don't actually produce the result through Karma
    const fakeResult = {
      suite: [
        'Sender',
        'using it',
        'get request'
      ],
      description: 'should not fail',
      log: []
    };

    // Requesting test for NEW xml format. Do not recycle the config used by OTHER tests,
    // since this would ruin them. Remember: since tests can run in undefined order, the side
    // effects (like configuration) must be carefully considered. beforeEach() caters for other tests
    // automatically.
    const newFakeConfig = {
      basePath: __dirname,
      junitReporter: {
        outputFile: path.normalize(
            path.join(testReportsPath, 'component-test-results/component_tests.xml')
        ),
        suite: '',
        xmlVersion: 1
      }
    };

    // Grab a new reporter, configured with xmlVersion flag
    const nxreporter = new reporterModule['reporter:junitxray'][1](fakeBaseReporterDecorator, newFakeConfig, fakeLogger, fakeHelper);
    nxreporter.onRunStart([fakeBrowser]);
    nxreporter.onBrowserStart(fakeBrowser);
    nxreporter.specSuccess(fakeBrowser, fakeResult);
    nxreporter.onBrowserComplete(fakeBrowser);
    nxreporter.onRunComplete();

    const writtenXml = fakeFs.writeFile.secondCall.args[1];
    const parsedXml = fastXmlParser.parse(writtenXml, {ignoreAttributes: false, parseAttributeValue: true, attributeNamePrefix: '__'});

    expect(fastXmlParser.validate(writtenXml)).to.be.true;

    expect(parsedXml.testsuites).to.exist;

    expect(parsedXml.testsuites.testsuite).to.exist;
    expect(parsedXml.testsuites.testsuite.__name).to.exist;
    expect(parsedXml.testsuites.testsuite.__package).to.exist;
    expect(parsedXml.testsuites.testsuite.__timestamp).to.exist;
    expect(parsedXml.testsuites.testsuite.__hostname).to.exist;

    expect(parsedXml.testsuites.testsuite.__id).to.equal(0);
    expect(parsedXml.testsuites.testsuite.__tests).to.equal(1);
    expect(parsedXml.testsuites.testsuite.__errors).to.equal(0);
    expect(parsedXml.testsuites.testsuite.__failures).to.equal(0);

    expect(parsedXml.testsuites.testsuite.testcase).to.exist;
    expect(parsedXml.testsuites.testsuite.testcase.__time).to.exist;

    expect(parsedXml.testsuites.testsuite.testcase.__requirements).to.equal('Not defined');
    expect(parsedXml.testsuites.testsuite.testcase.__name).to.equal('should not fail');
    expect(parsedXml.testsuites.testsuite.testcase.__classname).to.equal('Sender using it get request');

    // The 2 tests below are "static", weak tests that find whether a
    // string is present in the XML report
    expect(writtenXml).to.have.string('<testcase requirements="Not defined" name="should not fail" time="0" classname="Sender using it get request"/>');
    expect(writtenXml).to.have.string('testsuite name="Android"');
  });

  it('should include parent suite names in generated test names', function () {
    const fakeResult = {
      suite: [
        'Sender',
        'using it',
        'get request'
      ],
      description: 'should not fail',
      log: []
    };

    reporter.onRunStart([fakeBrowser]);
    reporter.onBrowserStart(fakeBrowser);
    reporter.specSuccess(fakeBrowser, fakeResult);
    reporter.onBrowserComplete(fakeBrowser);
    reporter.onRunComplete();

    expect(fakeFs.writeFile).to.have.been.called;

    const writtenXml = fakeFs.writeFile.secondCall.args[1];
    expect(writtenXml).to.have.string('<testcase requirements="Not defined" name="should not fail"')
  });

  it('should create output file with a unique name by adding timestamp to the name', function () {
    reporter.onRunStart([fakeBrowser]);
    reporter.onRunComplete();

    expect(fakeFs.writeFile).to.have.been.called;

    let fileName = fakeFs.writeFile.secondCall.args[0];
    console.debug('fileName: ' + fileName);
    const expectedUniqueFileName = fakeConfig.basePath + fakeConfig.junitXrayReporter.outputFile;
    expect(fileName).to.equal(expectedUniqueFileName);
  });

  describe('metadata file', function () {
    const fakeChromeBrowser = {
      id: 'Chrome_78_0_39',
      name: 'Chrome',
      fullName: 'Android 78.0.39',
      lastResult: {
        error: false,
        total: 1,
        failed: 0,
        netTime: 10 * 1000
      }
    };

    const fakeResult = {
      suite: [
        'Sender',
        'using it',
        'get request'
      ],
      description: 'should not fail',
      log: []
    };

    it('when env.buildversion is defined, it should produce a valid metadata file with env.buildversion value as buildVCSNumber', function () {
      process.env.buildVersion = '1.27.0-fakerelease.8';
      reporter.onRunStart([fakeChromeBrowser]);
      reporter.onBrowserStart(fakeChromeBrowser);
      reporter.specSuccess(fakeChromeBrowser, fakeResult);
      reporter.onBrowserComplete(fakeChromeBrowser);
      reporter.onRunComplete();

      expect(fakeFs.writeFile).to.have.been.called;

      const metadata = JSON.parse(fakeFs.writeFile.firstCall.args[1]);
      // debugger;
      console.debug('metadata: ' + JSON.stringify(metadata));
      expect(metadata.jiraProjectKey).to.have.string('CARE');
      expect(metadata.envProperties.buildCounter).to.have.string(process.env.buildVersion);
      process.env.buildVersion = undefined;
    });

    it('when env.buildversion is not defined, it should produce a valid metadata file with buildVCSNumber empty', function () {
      expect(process.env.buildVersion).to.have.string('undefined');
      reporter.onRunStart([fakeChromeBrowser]);
      reporter.onBrowserStart(fakeChromeBrowser);
      reporter.specSuccess(fakeChromeBrowser, fakeResult);
      reporter.onBrowserComplete(fakeChromeBrowser);
      reporter.onRunComplete();

      expect(fakeFs.writeFile).to.have.been.called;

      const metadata = JSON.parse(fakeFs.writeFile.firstCall.args[1]);
      expect(metadata.jiraProjectKey).to.have.string('CARE');
      expect(metadata.envProperties.buildCounter).to.have.string('undefined');
    });
  });

  it('should safely handle special characters', function () {
    const fakeResult = {
      suite: [
        'Sender',
        'using it',
        'get request'
      ],
      success: false,
      description: 'should not fail',
      log: ['Expected "👍" to be "👎".']
    };

    reporter.onRunStart([fakeBrowser]);
    reporter.onBrowserStart(fakeBrowser);
    reporter.specSuccess(fakeBrowser, fakeResult);
    reporter.onBrowserComplete(fakeBrowser);
    reporter.onRunComplete();

    expect(fakeFs.writeFile).to.have.been.called;

    const writtenXml = fakeFs.writeFile.secondCall.args[1];
    expect(writtenXml).to.have.string('<failure type="">Expected "👍" to be "👎".</failure>')
  });

  it('should safely handle invalid test result objects when onBrowserComplete fires', function () {
    const badBrowserResult = {
      id: 'Android_4_1_2',
      name: 'Android',
      fullName: 'Android 4.1.2',
      lastResult: {
        error: true,
        netTime: 0
      }
    };

    reporter.onRunStart([badBrowserResult]);

    // never pass a null value to XMLAttribute via xmlbuilder attr()
    expect(reporter.onBrowserComplete.bind(reporter, badBrowserResult)).not.to.throw(Error)
  });

  it('should safely handle test re-runs triggered by watchers', function () {
    reporter.onRunStart([fakeBrowser]);
    reporter.onBrowserStart(fakeBrowser);

    // When a watcher triggers a second test run, onRunStart() for the second
    // run gets triggered, followed by onRunComplete() from the first test run.
    reporter.onRunStart([fakeBrowser]);
    reporter.onBrowserStart(fakeBrowser);
    reporter.onBrowserComplete(fakeBrowser);
    reporter.onRunComplete()
  })
});
