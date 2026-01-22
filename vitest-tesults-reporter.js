const tesults = require('tesults');
const fs = require('fs');
const path = require('path');

// Supplemental data file for runtime data attachment
const supplementalDataFile = 'tesults-vitest-supplemental-data.json';

// Helper to get supplemental data
const getSupplementalData = () => {
  try {
    if (fs.existsSync(supplementalDataFile)) {
      const dataString = fs.readFileSync(supplementalDataFile, { encoding: 'utf8' });
      return JSON.parse(dataString);
    }
  } catch (err) {
    console.log('vitest-tesults-reporter error getting supplemental data: ' + err);
  }
  return {};
};

// Helper to set supplemental data
const setSupplementalData = (data) => {
  try {
    const fileContents = JSON.stringify(data);
    fs.writeFileSync(supplementalDataFile, fileContents);
  } catch (err) {
    console.log('vitest-tesults-reporter error saving supplemental data: ' + err);
  }
};

// Initialize supplemental data file
const initSupplementalData = () => {
  try {
    fs.writeFileSync(supplementalDataFile, '{}');
  } catch (err) {
    console.log('vitest-tesults-reporter error initializing supplemental data: ' + err);
  }
};

// Clean up supplemental data file
const cleanupSupplementalData = () => {
  try {
    if (fs.existsSync(supplementalDataFile)) {
      fs.unlinkSync(supplementalDataFile);
    }
  } catch {
    // Silently ignore cleanup errors
  }
};

/**
 * Get the current test name from Vitest's global expect.getState()
 * Returns null if called outside of a test context
 * Note: Requires globals: true in Vitest config
 */
const getCurrentTestName = () => {
  try {
    const state = expect.getState();
    if (state && state.currentTestName) {
      return state.currentTestName;
    }
  } catch {
    // expect may not be available (e.g., called outside test context)
  }
  console.log('vitest-tesults-reporter: Could not get current test name. Make sure globals: true is set in your Vitest config.');
  return null;
};

/**
 * Attach a file to the current test case
 * Call this from within your test to attach files to the test result
 *
 * @param {string} filePath - Absolute path to the file to attach
 *
 * @example
 * const { file } = require('vitest-tesults-reporter')
 *
 * test('my test', () => {
 *   file('/path/to/screenshot.png')
 * })
 */
const file = (filePath) => {
  const testName = getCurrentTestName();
  if (!testName || !filePath) {
    return;
  }

  const supplemental = getSupplementalData();

  if (supplemental[testName] === undefined) {
    supplemental[testName] = { files: [filePath] };
  } else {
    const data = supplemental[testName];
    if (data.files === undefined) {
      data.files = [filePath];
    } else {
      data.files.push(filePath);
    }
    supplemental[testName] = data;
  }
  setSupplementalData(supplemental);
};

/**
 * Add a description to the current test case
 *
 * @param {string} desc - Description text
 *
 * @example
 * const { description } = require('vitest-tesults-reporter')
 *
 * test('my test', () => {
 *   description('This test verifies login functionality')
 * })
 */
const description = (desc) => {
  const testName = getCurrentTestName();
  if (!testName) {
    return;
  }

  const supplemental = getSupplementalData();

  if (supplemental[testName] === undefined) {
    supplemental[testName] = { desc };
  } else {
    supplemental[testName].desc = desc;
  }
  setSupplementalData(supplemental);
};

/**
 * Add a step to the current test case
 *
 * @param {Object} stepData - Step object with name, desc (optional), and result
 * @param {string} stepData.name - Step name
 * @param {string} stepData.result - Step result ('pass', 'fail', or 'unknown')
 * @param {string} [stepData.desc] - Optional step description
 *
 * @example
 * const { step } = require('vitest-tesults-reporter')
 *
 * test('my test', () => {
 *   step({ name: 'Click login button', result: 'pass' })
 *   step({ name: 'Verify redirect', result: 'pass', desc: 'User redirected to dashboard' })
 * })
 */
const step = (stepData) => {
  const testName = getCurrentTestName();
  if (!testName || !stepData) {
    return;
  }

  const supplemental = getSupplementalData();

  if (supplemental[testName] === undefined) {
    supplemental[testName] = { steps: [stepData] };
  } else {
    const data = supplemental[testName];
    if (data.steps === undefined) {
      data.steps = [stepData];
    } else {
      data.steps.push(stepData);
    }
    supplemental[testName] = data;
  }
  setSupplementalData(supplemental);
};

/**
 * Add custom data to the current test case
 * Custom fields will be prefixed with underscore in Tesults
 *
 * @param {string} name - Custom field name (will be prefixed with _)
 * @param {*} value - Custom field value
 *
 * @example
 * const { custom } = require('vitest-tesults-reporter')
 *
 * test('my test', () => {
 *   custom('browser', 'chrome')
 *   custom('priority', 'high')
 * })
 */
const custom = (name, value) => {
  const testName = getCurrentTestName();
  if (!testName || !name) {
    return;
  }

  const supplemental = getSupplementalData();

  if (supplemental[testName] === undefined) {
    supplemental[testName] = { custom: { [name]: value } };
  } else {
    const data = supplemental[testName];
    if (data.custom === undefined) {
      data.custom = { [name]: value };
    } else {
      data.custom[name] = value;
    }
    supplemental[testName] = data;
  }
  setSupplementalData(supplemental);
};

/**
 * Vitest Tesults Reporter
 *
 * Reports Vitest test results to Tesults.com
 */
class TesultsReporter {
  constructor(options) {
    this.options = options || {};
    this.cases = [];
  }

  onInit(ctx) {
    this.ctx = ctx;
    this.cases = [];
    initSupplementalData();
  }

  /**
   * Map Vitest test state to Tesults result
   */
  mapResult(state) {
    switch (state) {
      case 'pass':
        return 'pass';
      case 'fail':
        return 'fail';
      case 'skip':
      case 'todo':
      default:
        return 'unknown';
    }
  }

  /**
   * Get suite hierarchy parts from a task (walking up the parent chain)
   */
  getSuiteHierarchyParts(task) {
    const parts = [];

    // Walk up the parent chain to build suite hierarchy
    let current = task.suite;
    while (current) {
      if (current.name) {
        parts.unshift(current.name);
      }
      current = current.suite;
    }

    return parts;
  }

  /**
   * Get the full test name as Vitest formats it in currentTestName
   * Format: "Suite > nested suite > test name"
   */
  getFullTestName(task) {
    const parts = this.getSuiteHierarchyParts(task);
    parts.push(task.name);
    return parts.join(' > ');
  }

  /**
   * Get suite hierarchy as a string for Tesults (using " - " separator)
   */
  getSuiteHierarchy(task, file) {
    const parts = this.getSuiteHierarchyParts(task);

    // If no suite found, use the file's relative path
    if (parts.length === 0 && file.filepath) {
      const relativePath = path.relative(process.cwd(), file.filepath);
      return relativePath;
    }

    return parts.join(' - ');
  }

  /**
   * Get files for a test case from the files directory
   */
  caseFiles(suite, name) {
    const files = [];
    const filesDir = this.options['tesults-files'];

    if (!filesDir) {
      return files;
    }

    try {
      let filesPath;
      if (!suite) {
        filesPath = path.join(filesDir, name);
      } else {
        filesPath = path.join(filesDir, suite, name);
      }

      if (fs.existsSync(filesPath) && fs.statSync(filesPath).isDirectory()) {
        fs.readdirSync(filesPath).forEach((f) => {
          if (f !== '.DS_Store') {
            files.push(path.join(filesPath, f));
          }
        });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log('vitest-tesults-reporter error reading case files: ' + err);
      }
    }

    return files;
  }

  /**
   * Process a single task and convert to Tesults format
   */
  processTask(task, file) {
    // Only process test tasks (not suites)
    if (task.type !== 'test') {
      return null;
    }

    const result = task.result;
    const suite = this.getSuiteHierarchy(task, file);
    const name = task.name;

    const tesultsCase = {
      name,
      result: this.mapResult(result?.state),
      rawResult: result?.state
    };

    // Add suite if available
    if (suite) {
      tesultsCase.suite = suite;
    }

    // Add duration
    if (result?.duration !== undefined) {
      tesultsCase.duration = result.duration;
    }

    // Add failure reason
    if (result?.state === 'fail' && result.errors && result.errors.length > 0) {
      const reasons = result.errors.map((err) => {
        if (typeof err === 'object' && err !== null) {
          return err.stack || err.message || String(err);
        }
        return String(err);
      });
      tesultsCase.reason = reasons.join('\n\n');
    }

    // Get files from directory structure
    const dirFiles = this.caseFiles(suite, name);
    if (dirFiles.length > 0) {
      tesultsCase.files = dirFiles;
    }

    // Get supplemental data (files, description, steps, custom)
    // Use the full test name (same format as Vitest's currentTestName: "Suite > nested > test name")
    const supplemental = getSupplementalData();
    const fullTestName = this.getFullTestName(task);
    const data = supplemental[fullTestName];

    if (data) {
      // Add supplemental files
      if (data.files && data.files.length > 0) {
        const uniqueFiles = [...new Set([...(tesultsCase.files || []), ...data.files])];
        tesultsCase.files = uniqueFiles;
      }

      // Add description
      if (data.desc) {
        tesultsCase.desc = data.desc;
      }

      // Add steps (with deduplication of consecutive duplicates)
      if (data.steps && data.steps.length > 0) {
        const cleanedSteps = [];
        for (const s of data.steps) {
          if (cleanedSteps.length > 0) {
            const lastStep = cleanedSteps[cleanedSteps.length - 1];
            if (s.name === lastStep.name && s.result === lastStep.result) {
              // Skip consecutive duplicate
              continue;
            }
          }
          cleanedSteps.push(s);
        }
        tesultsCase.steps = cleanedSteps;
      }

      // Add custom fields (prefixed with _)
      if (data.custom) {
        for (const [fieldName, fieldValue] of Object.entries(data.custom)) {
          tesultsCase[`_${fieldName}`] = fieldValue;
        }
      }
    }

    return tesultsCase;
  }

  /**
   * Recursively collect all test tasks from a file
   */
  collectTasks(tasks, file) {
    for (const task of tasks) {
      if (task.type === 'test') {
        const tesultsCase = this.processTask(task, file);
        if (tesultsCase) {
          this.cases.push(tesultsCase);
        }
      } else if (task.type === 'suite' && task.tasks) {
        // Recursively process suite children
        this.collectTasks(task.tasks, file);
      }
    }
  }

  /**
   * Called when all tests have completed
   */
  onFinished(files, errors) {
    // Check for target token
    const target = this.options['tesults-target'];
    if (!target) {
      console.log('tesults-target not provided. Tesults disabled.');
      cleanupSupplementalData();
      return;
    }

    // Determine overall result
    let overallResult = 'passed';
    if (errors && errors.length > 0) {
      overallResult = 'failed';
    }

    // Collect all test tasks from all files
    if (files) {
      for (const file of files) {
        if (file.tasks) {
          this.collectTasks(file.tasks, file);
        }

        // Check if any tests failed
        if (file.result?.state === 'fail') {
          overallResult = 'failed';
        }
      }
    }

    // Add build information if provided
    const buildName = this.options['tesults-build-name'];
    if (buildName) {
      const buildCase = {
        name: buildName || '-',
        suite: '[build]',
        result: this.options['tesults-build-result'] || (overallResult === 'passed' ? 'pass' : overallResult === 'failed' ? 'fail' : 'unknown')
      };

      if (this.options['tesults-build-desc']) {
        buildCase.desc = this.options['tesults-build-desc'];
      }

      if (this.options['tesults-build-reason']) {
        buildCase.reason = this.options['tesults-build-reason'];
      }

      // Get files for build
      const filesDir = this.options['tesults-files'];
      if (filesDir) {
        buildCase.files = this.caseFiles('[build]', buildName);
      }

      this.cases.push(buildCase);
    }

    // Clean up supplemental data file
    cleanupSupplementalData();

    // Prepare data for Tesults
    const data = {
      target,
      results: {
        cases: this.cases
      },
      metadata: {
        integration_name: 'vitest-tesults-reporter',
        integration_version: '1.0.0',
        test_framework: 'vitest'
      }
    };

    // Upload to Tesults
    return new Promise((resolve) => {
      tesults.results(data, (err, response) => {
        if (err) {
          console.log('Tesults library error, failed to upload.');
          console.log(err);
        } else {
          console.log('Tesults results upload:');
          console.log('  Success: ' + response.success);
          console.log('  Message: ' + response.message);
          if (response.warnings && response.warnings.length > 0) {
            console.log('  Warnings: ' + response.warnings.length);
            response.warnings.forEach((w) => console.log('    - ' + w));
          }
          if (response.errors && response.errors.length > 0) {
            console.log('  Errors: ' + response.errors.length);
            response.errors.forEach((e) => console.log('    - ' + e));
          }
        }
        resolve();
      });
    });
  }
}

module.exports = TesultsReporter;
module.exports.file = file;
module.exports.description = description;
module.exports.step = step;
module.exports.custom = custom;
