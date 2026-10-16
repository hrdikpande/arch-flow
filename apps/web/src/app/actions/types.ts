/** Result shape for form actions. `error` is shown to the user. */
export type FormState = { error?: string; ok?: string } | null;

export function errorState(error: unknown): FormState {
  return { error: error instanceof Error ? error.message : 'Something went wrong. Try again.' };
}
