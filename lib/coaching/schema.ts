// Claude's wire schema supports shape/enums but not these bounds. The shared
// prompt describes them and the original Zod schema still enforces every bound.
export function providerSchemaShape(schema: object): Record<string, unknown> {
  const unsupported = new Set(["minimum", "maximum", "minLength", "maxLength", "maxItems", "minItems"]);
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !unsupported.has(key)).map(([key, child]) => [key, visit(child)]));
    return value;
  }
  return visit(schema) as Record<string, unknown>;
}

