import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiProblemError } from "../../lib/api/browser";

export function applyFormProblem<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): string {
  if (!(error instanceof ApiProblemError)) {
    return "The request could not be completed. Check the service and try again.";
  }

  let focusedField = false;
  for (const issue of error.problem.errors ?? []) {
    const field = issue.path[0];
    if (typeof field === "string" && knownFields.includes(field as Path<T>)) {
      setError(
        field as Path<T>,
        { message: issue.message, type: "server" },
        { shouldFocus: !focusedField },
      );
      focusedField = true;
    }
  }

  return error.problem.detail ?? `${error.problem.title}. Try again.`;
}
