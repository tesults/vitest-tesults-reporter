import type { Reporter } from 'vitest';

export interface TesultsReporterOptions {
  'tesults-target': string;
  'tesults-files'?: string;
  'tesults-build-name'?: string;
  'tesults-build-desc'?: string;
  'tesults-build-result'?: 'pass' | 'fail' | 'unknown';
  'tesults-build-reason'?: string;
}

export interface TesultsStep {
  name: string;
  desc?: string;
  result: 'pass' | 'fail' | 'unknown';
}

/**
 * Attach a file to the current test case
 * @param filePath - Absolute path to the file to attach
 */
export function file(filePath: string): void;

/**
 * Add a description to the current test case
 * @param desc - Description text
 */
export function description(desc: string): void;

/**
 * Add a step to the current test case
 * @param stepData - Step object with name, desc (optional), and result
 */
export function step(stepData: TesultsStep): void;

/**
 * Add custom data to the current test case
 * @param name - Custom field name (will be prefixed with _ in Tesults)
 * @param value - Custom field value
 */
export function custom(name: string, value: unknown): void;

/**
 * Vitest Tesults Reporter
 * Reports Vitest test results to Tesults.com
 */
declare class TesultsReporter implements Reporter {
  constructor(options: TesultsReporterOptions);
}

export default TesultsReporter;
