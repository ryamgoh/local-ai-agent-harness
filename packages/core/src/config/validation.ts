import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';
import type { FormatsPlugin } from 'ajv-formats';
import type { ConfigIssue } from '../errors.js';

const addFormats = createRequire(import.meta.url)('ajv-formats') as FormatsPlugin;
export type { JsonSchemaObject } from '../manifest/schema.js';
export interface ValidationResult {
  success: boolean;
  value: unknown;
  errors: string[];
}
export function createValidator(coerce = false): Ajv2020 {
  const ajv = new Ajv2020({
    useDefaults: true,
    coerceTypes: coerce,
    allErrors: true,
    strict: true,
    ownProperties: true,
  });
  addFormats(ajv);
  ajv.addKeyword({ keyword: 'x-secret', schemaType: 'boolean', valid: true });
  ajv.addKeyword({ keyword: 'x-path-kind', schemaType: 'string', valid: true });
  ajv.addFormat('path', {
    type: 'string',
    validate: (p: string) => p.length > 0 && !p.includes('\0'),
  });
  return ajv;
}
const stored = createValidator();
const cli = createValidator(true);
const storedCache = new WeakMap<object, ValidateFunction>();
const cliCache = new WeakMap<object, ValidateFunction>();
export function validateSchema(schema: object): boolean {
  try {
    let validate = storedCache.get(schema);
    if (!validate) {
      validate = stored.compile(schema);
      storedCache.set(schema, validate);
    }
    return !('$async' in validate && validate.$async);
  } catch {
    return false;
  }
}
export function validationIssues(errors: ErrorObject[] | null | undefined): ConfigIssue[] {
  return (errors ?? []).map((e) => {
    const parts = e.instancePath
      .split('/')
      .slice(1)
      .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (e.keyword === 'required') parts.push(String(e.params.missingProperty));
    if (e.keyword === 'additionalProperties') parts.push(String(e.params.additionalProperty));
    return {
      key: parts.join('.'),
      message: e.keyword === 'required' ? 'is required' : (e.message ?? 'is invalid'),
    };
  });
}
export interface DetailedValidationResult extends ValidationResult {
  issues: ConfigIssue[];
}
/** Applies validation/defaults on a copy; malformed schemas and non-JSON inputs fail without echoing data. */
export function validateDetailed(
  schema: object,
  value: unknown,
  coerce = false,
): DetailedValidationResult {
  let copy: unknown;
  try {
    copy = structuredClone(value);
  } catch {
    return {
      success: false,
      value: undefined,
      errors: ['must be JSON-compatible'],
      issues: [{ key: '', message: 'must be JSON-compatible' }],
    };
  }
  try {
    const cache = coerce ? cliCache : storedCache;
    let validate = cache.get(schema);
    if (!validate) {
      validate = (coerce ? cli : stored).compile(schema);
      cache.set(schema, validate);
    }
    if ('$async' in validate && validate.$async)
      throw new Error('Asynchronous schemas are not supported');
    const success = validate(copy) === true;
    const issues = validationIssues(validate.errors);
    return {
      success,
      value: copy,
      errors: (validate.errors ?? []).map(
        (e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`,
      ),
      issues,
    };
  } catch {
    return {
      success: false,
      value: copy,
      errors: ['invalid or unsupported JSON schema'],
      issues: [{ key: '', message: 'invalid or unsupported JSON schema' }],
    };
  }
}
export function validateValue(schema: object, value: unknown): ValidationResult {
  const { success, value: validated, errors } = validateDetailed(schema, value);
  return { success, value: validated, errors };
}
