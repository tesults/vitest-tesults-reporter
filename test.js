const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tesults = require('tesults');
const TesultsReporter = require('./vitest-tesults-reporter');

const originalResults = tesults.results;
const originalOutputFileEnv = process.env.TESULTS_OUTPUT_FILE;
const originalExpect = global.expect;
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-tesults-reporter-'));
const uploads = [];
let uploadError;
let currentTestName;

tesults.results = (data, callback) => {
  uploads.push(JSON.parse(JSON.stringify(data)));
  setImmediate(() => callback(uploadError, {
    success: true,
    message: 'ok',
    warnings: [],
    errors: []
  }));
};

global.expect = {
  getState: () => ({ currentTestName })
};

const makeFiles = () => {
  const topSuite = { type: 'suite', name: 'checkout', tasks: [] };
  const nestedSuite = { type: 'suite', name: 'card', suite: topSuite, tasks: [] };
  const passed = {
    type: 'test',
    name: 'passes',
    suite: nestedSuite,
    location: { line: 14, column: 5 },
    result: { state: 'pass', duration: 12 }
  };
  const failed = {
    type: 'test',
    name: 'fails',
    suite: nestedSuite,
    result: {
      state: 'fail',
      duration: 8,
      errors: [{ message: 'Expected true to be false', stack: 'Error: Expected true to be false\n    at example.test.js:20:4' }]
    }
  };
  const skipped = {
    type: 'test',
    name: 'is skipped',
    suite: nestedSuite,
    result: { state: 'skip', duration: 0 }
  };
  nestedSuite.tasks.push(passed, failed, skipped);
  topSuite.tasks.push(nestedSuite);
  return [{
    filepath: '/workspace/tests/example.test.js',
    tasks: [topSuite],
    result: { state: 'fail' }
  }];
};

const complete = async (options, files = makeFiles(), errors = []) => {
  const reporter = new TesultsReporter(options);
  reporter.onInit({});
  await reporter.onFinished(files, errors);
};

(async () => {
  try {
    process.chdir(tempDir);
    delete process.env.TESULTS_OUTPUT_FILE;

    const filesRoot = path.join(tempDir, 'captured');
    const caseFilesDir = path.join(filesRoot, 'checkout - card', 'passes');
    const configuredFile = path.join(caseFilesDir, 'runner.log');
    const supplementalFile = path.join(tempDir, 'screenshot.png');
    fs.mkdirSync(caseFilesDir, { recursive: true });
    fs.writeFileSync(configuredFile, 'log');
    fs.writeFileSync(supplementalFile, 'image');

    const targetOnly = new TesultsReporter({
      'tesults-target': 'target-token',
      'tesults-files': filesRoot,
      'tesults-build-name': 'build',
      'tesults-build-desc': 'build description',
      'tesults-build-result': 'pass',
      'tesults-build-reason': 'build reason'
    });
    targetOnly.onInit({});
    currentTestName = 'checkout > card > passes';
    TesultsReporter.file(supplementalFile);
    TesultsReporter.file(supplementalFile);
    TesultsReporter.description('checkout description');
    TesultsReporter.step({ name: 'open cart', result: 'pass', desc: 'opened' });
    TesultsReporter.step({ name: 'open cart', result: 'pass' });
    TesultsReporter.custom('Browser', 'chromium');
    await targetOnly.onFinished(makeFiles(), []);

    assert.strictEqual(uploads.length, 1);
    const targetPayload = uploads[0];
    assert.strictEqual(targetPayload.target, 'target-token');
    assert.deepStrictEqual(targetPayload.metadata, {
      integration_name: 'vitest-tesults-reporter',
      integration_version: '1.1.0',
      test_framework: 'vitest'
    });
    assert.strictEqual(targetPayload.results.cases.length, 4);
    const passed = targetPayload.results.cases[0];
    assert.strictEqual(passed.name, 'passes');
    assert.strictEqual(passed.suite, 'checkout - card');
    assert.strictEqual(passed.result, 'pass');
    assert.strictEqual(passed.rawResult, 'pass');
    assert.strictEqual(passed.duration, 12);
    assert.deepStrictEqual(JSON.parse(passed._Location), {
      file: '/workspace/tests/example.test.js',
      line: 14,
      column: 5
    });
    assert.deepStrictEqual(passed.files, [configuredFile, supplementalFile]);
    assert.strictEqual(passed.desc, 'checkout description');
    assert.deepStrictEqual(passed.steps, [{ name: 'open cart', result: 'pass', desc: 'opened' }]);
    assert.strictEqual(passed._Browser, 'chromium');
    assert.strictEqual(targetPayload.results.cases[1].result, 'fail');
    assert.ok(targetPayload.results.cases[1].reason.includes('Expected true to be false'));
    assert.strictEqual(targetPayload.results.cases[2].result, 'unknown');
    assert.strictEqual(targetPayload.results.cases[2].rawResult, 'skip');
    assert.deepStrictEqual(targetPayload.results.cases[3], {
      name: 'build',
      suite: '[build]',
      result: 'pass',
      desc: 'build description',
      reason: 'build reason',
      files: []
    });

    const fileOnlyPath = path.join(tempDir, 'file-only', 'tesults-results.json');
    await complete({
      'tesults-output-file': fileOnlyPath,
      'tesults-build-name': 'automatic-build'
    });
    assert.strictEqual(uploads.length, 1);
    const fileOnlyPayload = JSON.parse(fs.readFileSync(fileOnlyPath, 'utf8'));
    assert.strictEqual(fileOnlyPayload.target, '');
    assert.strictEqual(fileOnlyPayload.results.cases.length, 4);
    assert.strictEqual(fileOnlyPayload.results.cases[3].suite, '[build]');
    assert.strictEqual(fileOnlyPayload.results.cases[3].result, 'fail');

    const bothPath = path.join(tempDir, 'both', 'tesults-results.json');
    await complete({
      'tesults-target': 'target-token-both',
      'tesults-output-file': bothPath
    });
    assert.strictEqual(uploads.length, 2);
    assert.strictEqual(uploads[1].target, 'target-token-both');
    const bothPayload = JSON.parse(fs.readFileSync(bothPath, 'utf8'));
    assert.strictEqual(bothPayload.target, '');
    assert.deepStrictEqual(bothPayload.results, uploads[1].results);
    assert.deepStrictEqual(bothPayload.metadata, uploads[1].metadata);

    const envOnlyPath = path.join(tempDir, 'env-only', 'tesults-results.json');
    process.env.TESULTS_OUTPUT_FILE = envOnlyPath;
    await complete({});
    assert.ok(fs.existsSync(envOnlyPath));
    assert.strictEqual(uploads.length, 2);

    const envAndTargetPath = path.join(tempDir, 'env-and-target', 'tesults-results.json');
    process.env.TESULTS_OUTPUT_FILE = envAndTargetPath;
    await complete({ 'tesults-target': 'target-token-env' });
    assert.ok(fs.existsSync(envAndTargetPath));
    assert.strictEqual(JSON.parse(fs.readFileSync(envAndTargetPath, 'utf8')).target, '');
    assert.strictEqual(uploads.length, 3);
    assert.strictEqual(uploads[2].target, 'target-token-env');

    const configuredPath = path.join(tempDir, 'env-wins', 'configured.json');
    const envOverridePath = path.join(tempDir, 'env-wins', 'environment.json');
    process.env.TESULTS_OUTPUT_FILE = envOverridePath;
    await complete({ 'tesults-output-file': configuredPath });
    assert.ok(fs.existsSync(envOverridePath));
    assert.ok(!fs.existsSync(configuredPath));

    const emptyEnvFallbackPath = path.join(tempDir, 'empty-env', 'configured.json');
    process.env.TESULTS_OUTPUT_FILE = '';
    await complete({ 'tesults-output-file': emptyEnvFallbackPath });
    assert.ok(fs.existsSync(emptyEnvFallbackPath));

    delete process.env.TESULTS_OUTPUT_FILE;
    await complete({});
    assert.strictEqual(uploads.length, 3);

    uploadError = new Error('upload failed');
    await complete({ 'tesults-target': 'upload-error-target' });
    assert.strictEqual(uploads.length, 4);
    uploadError = undefined;

    await assert.rejects(
      complete({ 'tesults-output-file': tempDir }),
      (err) => err && (err.code === 'EISDIR' || /directory/i.test(err.message))
    );

    await assert.rejects(
      complete({
        'tesults-target': 'target-despite-write-error',
        'tesults-output-file': tempDir
      }),
      (err) => err && (err.code === 'EISDIR' || /directory/i.test(err.message))
    );
    assert.strictEqual(uploads.length, 5);
    assert.strictEqual(uploads[4].target, 'target-despite-write-error');

    console.log('All tests passed.');
  } finally {
    tesults.results = originalResults;
    if (originalOutputFileEnv === undefined) {
      delete process.env.TESULTS_OUTPUT_FILE;
    } else {
      process.env.TESULTS_OUTPUT_FILE = originalOutputFileEnv;
    }
    if (originalExpect === undefined) {
      delete global.expect;
    } else {
      global.expect = originalExpect;
    }
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
