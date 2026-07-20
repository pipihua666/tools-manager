export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export function assertUsage(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new UsageError(message);
  }
}
