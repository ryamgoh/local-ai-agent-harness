import { confirm, input, number, password, select } from '@inquirer/prompts';
import { CliError } from './context.js';

export type SchemaObject = Record<string, unknown>;
export interface PromptField {
  key: string;
  kind: 'input' | 'confirm' | 'select' | 'password' | 'number';
  message: string;
  property: SchemaObject;
  value?: unknown;
  required: boolean;
}
export function schemaFields(schema: SchemaObject, values: Record<string, unknown>): PromptField[] {
  const properties = schema.properties as Record<string, SchemaObject> | undefined;
  const required = Array.isArray(schema.required) ? schema.required : [];
  return Object.entries(properties ?? {}).map(([key, property]) => ({
    key,
    property,
    value: values[key],
    required: required.includes(key),
    message: `${typeof property.title === 'string' ? property.title : key}${typeof property.description === 'string' ? ` — ${property.description}` : ''}`,
    kind:
      property['x-secret'] === true
        ? 'password'
        : Array.isArray(property.enum)
          ? 'select'
          : property.type === 'boolean'
            ? 'confirm'
            : ['number', 'integer'].includes(String(property.type))
              ? 'number'
              : 'input',
  }));
}
export async function promptConfirm(message: string): Promise<boolean> {
  try {
    return await confirm({ message, default: false }, { output: process.stderr });
  } catch (error) {
    return promptFailure(error);
  }
}
function promptFailure(error: unknown): never {
  if (error instanceof Error && ['ExitPromptError', 'AbortPromptError'].includes(error.name))
    throw new CliError('Consent declined', 3);
  throw error;
}
export async function promptField(
  field: PromptField,
  streams: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } = {},
): Promise<string | undefined> {
  const context = { output: process.stderr, ...streams };
  const validate = (value: string): boolean | string =>
    !field.required || value.length > 0 || 'A value is required';
  try {
    if (field.kind === 'confirm')
      return String(
        await confirm(
          {
            message: field.message,
            default: typeof field.value === 'boolean' ? field.value : false,
          },
          context,
        ),
      );
    if (field.kind === 'select') {
      const values = field.property.enum as unknown[];
      const chosen = await select(
        {
          message: field.message,
          choices: values.map((value, index) => ({ name: String(value), value: index })),
          default:
            values.findIndex((value) => Object.is(value, field.value)) >= 0
              ? values.findIndex((value) => Object.is(value, field.value))
              : undefined,
        },
        context,
      );
      const value = values[chosen];
      return typeof value === 'string' ? value : JSON.stringify(value);
    }
    if (field.kind === 'password') {
      const value = await password(
        {
          message: field.message,
          mask: '*',
          validate: field.value === undefined ? validate : undefined,
        },
        context,
      );
      return value || (field.value === undefined ? '' : undefined);
    }
    if (field.kind === 'number') {
      const value = await number(
        {
          message: field.message,
          default: typeof field.value === 'number' ? field.value : undefined,
          min: typeof field.property.minimum === 'number' ? field.property.minimum : undefined,
          max: typeof field.property.maximum === 'number' ? field.property.maximum : undefined,
          required: field.required,
          validate:
            field.property.type === 'integer'
              ? (value) => value === undefined || Number.isInteger(value) || 'Must be an integer'
              : undefined,
        },
        context,
      );
      return value === undefined ? undefined : String(value);
    }
    const value = await input(
      {
        message: field.message,
        default:
          typeof field.value === 'string'
            ? field.value
            : field.value === undefined
              ? undefined
              : JSON.stringify(field.value),
        validate,
      },
      context,
    );
    return value === '' && !field.required && field.value === undefined ? undefined : value;
  } catch (error) {
    return promptFailure(error);
  }
}
