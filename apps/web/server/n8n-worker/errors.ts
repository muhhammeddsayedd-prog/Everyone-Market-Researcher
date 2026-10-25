import 'server-only';
export class WorkerFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
