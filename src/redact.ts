/**
 * Local redaction helper (no CLI dependency).
 *
 * Values are used only to remove matching substrings from tool output; they
 * are never returned, logged, or placed in tool arguments.
 */

export function createRedactor(
  secrets: readonly (string | undefined)[],
): (text: string) => string {
  const values = [...new Set(secrets.filter((value): value is string => Boolean(value)))]
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
  if (values.length === 0) return (text) => text;
  return (text) => {
    let result = text;
    for (const value of values) result = result.split(value).join("[redacted]");
    return result;
  };
}
