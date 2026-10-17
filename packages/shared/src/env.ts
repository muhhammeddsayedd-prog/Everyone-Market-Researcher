import type { ZodType } from 'zod';

/**
 * Validate server configuration on explicit invocation, never during imports.
 * Supply a synchronous Zod schema; its parsed output determines the return type.
 * https://zod.dev/basics#handling-errors
 */
export function parseEnv<Output>(schema: ZodType<Output>): Output {
  if ('window' in globalThis || typeof process === 'undefined') {
    throw new Error('parseEnv can only be called on the server.');
  }

  let result;
  try {
    result = schema.safeParse(process.env);
  } catch {
    // A custom refinement/transform may throw an exception containing a value.
    throw new Error('Server environment validation failed; check the schema.');
  }

  if (!result.success) {
    // Schema messages can include input values. Report only field paths and
    // stable issue codes, without retaining the ZodError as an error cause.
    // https://zod.dev/error-customization#include-input-in-issues
    const issues = result.error.issues.map((issue) => {
      const field = issue.path.map(String).join('.') || '<environment>';
      return `${field} (${issue.code})`;
    });
    throw new Error(`Invalid server environment: ${issues.join('; ')}`);
  }

  return result.data;
}
