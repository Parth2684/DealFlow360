export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }>;
  code?: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
    public readonly code?: string,
    public readonly errors?: Array<{ field: string; message: string }>,
  ) {
    super(detail ?? title);
    this.name = "AppError";
  }

  toProblemDetails(instance?: string): ProblemDetails {
    return {
      type: `https://dealflow360.dev/errors/${this.code ?? "unknown"}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance,
      code: this.code,
      errors: this.errors,
    };
  }
}

export const Errors = {
  unauthorized: (detail = "Authentication required") =>
    new AppError(401, "Unauthorized", detail, "unauthorized"),
  forbidden: (detail = "Insufficient permissions") =>
    new AppError(403, "Forbidden", detail, "forbidden"),
  notFound: (entity: string) =>
    new AppError(404, "Not Found", `${entity} not found`, "not_found"),
  conflict: (detail: string) =>
    new AppError(409, "Conflict", detail, "conflict"),
  validation: (
    errors: Array<{ field: string; message: string }>,
    detail = "Validation failed",
  ) => new AppError(422, "Unprocessable Entity", detail, "validation", errors),
  badRequest: (detail: string) =>
    new AppError(400, "Bad Request", detail, "bad_request"),
  internal: (detail = "Internal server error") =>
    new AppError(500, "Internal Server Error", detail, "internal"),
};
