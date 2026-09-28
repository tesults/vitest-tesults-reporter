# Vitest Tesults Reporter

Report Vitest test results to Tesults, write them to a local JSON file, or do both in the same run.

## Installation

```sh
npm install --save-dev vitest-tesults-reporter
```

## Upload results to Tesults

Add the reporter to your Vitest configuration with your Tesults target token:

```js
import { defineConfig } from 'vitest/config';
import TesultsReporter from 'vitest-tesults-reporter';

export default defineConfig({
  test: {
    reporters: [
      'default',
      new TesultsReporter({
        'tesults-target': 'token'
      })
    ]
  }
});
```

Existing target-only configurations continue to upload results as before.

## Write results locally

Use `tesults-output-file` to write the Tesults JSON payload without uploading it:

```js
new TesultsReporter({
  'tesults-output-file': './test-results/tesults-results.json'
})
```

No Tesults account or target token is required for local output. Parent directories are created automatically. The local payload has an empty `target` value.

`tesults-target` and `tesults-output-file` can be used independently or together. When both are configured, the reporter writes the local payload and uploads the results to Tesults.

The output file can also be supplied through the `TESULTS_OUTPUT_FILE` environment variable. When set to a non-empty value, the environment path overrides the `tesults-output-file` reporter option for that run.

## GitHub Actions reporting

The [Test Automation Reporting for GitHub Actions](https://github.com/tesults/test-automation-reporting) action supplies `TESULTS_OUTPUT_FILE` automatically. Place the action before the Vitest test step:

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run Vitest tests
  run: npm test
```

Keep `vitest-tesults-reporter` in your Vitest configuration. A target token is optional.

Source locations are included when Vitest provides task locations. Enable `includeTaskLocation: true` in compatible Vitest versions when you want file and line links in the GitHub report.

## Documentation

Full Vitest reporter documentation is available at https://www.tesults.com/docs/vitest.

## Testing

```sh
npm test
```

## Support

help@tesults.com
