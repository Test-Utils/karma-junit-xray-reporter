# karma-junit-xray-reporter

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://scm.sapphirepri.com/arsalan.siddiqui/karma-junit-xray-reporter.git)
 

> The initial code is copied from karma-junit-reporter plugin  and we modified workflow, options and the results output. Also added xrayId only option 

## Installation

The easiest way is to keep `karma-junit-xray-reporter` as a devDependency in your `package.json` pointing to its current repo 

```bash
"karma-junit-xray-reporter": "git+https://scm.sapphirepri.com/arsalan.siddiqui/karma-junit-xray-reporter.git"
```

To update to the latest version
```bash
npm update karma-junit-xray-reporter
```

## Run Tests
To run tests
```bash
npm test
```

If you want to skip eslinter and directly run just tests
```bash
mocha tests/reporter.spec.js
```
## Run Tests with coverage
Run tests with coverage
```bash
npm run test-with-coverage
```

## Configuration

```js
// karma.conf.js
module.exports = function(config) {
  config.set({
    reporters: ['progress', 'junitxray'],

    // the default configuration
    junitXrayReporter: {
      metadataFile: 'unit-tests/meta-data.json'// optional path and name of metadataFile
      outputFile: 'unit-tests/result-output.xml'// optional path and name of the output file
      suite: '',// suite will become the package name attribute in xml testsuite element
      xrayIdOnly: true, //(default false) set it to true to process only the tests that have xrayId like :XRAY-ID:XRAY-123: in the tests name for e.g ':XRAY-ID:XRAY-123: test to validate params'
    }
  });
};
```

You can pass list of reporters as a CLI argument too:
```bash
karma start --reporters junitxray,dots
```

Example junit xray xml report:
```xml
<?xml version="1.0"?>
<testsuite name="PhantomJS 1.9.8 (Linux)" package="models" timestamp="2015-03-10T13:59:23" id="0" hostname="admin" tests="629" errors="0" failures="0" time="11.452">
 <testcase xrayId="XRAY-123" name="(C.2) Checks if an empty object is returned when error 404 is encountered" time="0.01" classname="pr_tdata CTRL: prTdataLineTrendGraphsController Commence prTdataLineTrendGraphsController testing =>  getBMIStatsValue()"/>
  </testsuite>"/>
 <testcase xrayId="XRAY-223" name="(C.3) Checks if an empty array is returned when error 405 is encountered" time="0.013" classname="pr_tdata CTRL: prTdataLineTrendGraphsController Commence prTdataLineTrendGraphsController testing =>  getBMIStatsValue()"/>
  </testsuite>"/>
</testsuite>
...
```
----

For more information on Karma see the [homepage].


[homepage]: http://karma-runner.github.com

