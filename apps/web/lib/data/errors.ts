/**
 * A failed read. The message shown to users never includes database details;
 * only the area and Postgres/PostgREST code are logged server-side.
 */
export class DataReadError extends Error {
  readonly area: string;
  readonly code: string | undefined;

  constructor(area: string, cause?: { code?: string; message?: string } | null) {
    super(`Read failed: ${area}`);
    this.name = 'DataReadError';
    this.area = area;
    this.code = cause?.code;
    // Log a minimal, secret-free line for operators.
    console.error(`[data] ${area} read failed`, cause?.code ?? 'unknown');
  }
}
