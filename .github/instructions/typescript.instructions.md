---
applyTo: "**/*.{ts,tsx,mts,cts}"
---

# TypeScript Instructions

- Follow the project's existing `tsconfig.json` — don't change compiler options without discussion
- Use explicit types for function parameters and return values; infer for local variables
- Prefer `interface` for object shapes, `type` for unions/intersections/mapped types
- Use `readonly` for properties that shouldn't be reassigned after initialization
- Prefer `unknown` over `any` — narrow types explicitly with type guards
- Use discriminated unions (tagged unions) over optional fields when variants are mutually exclusive
- Avoid type assertions (`as`) unless the type system genuinely can't express the constraint
- Use `satisfies` operator to validate types without widening
- Handle `null`/`undefined` explicitly — don't rely on loose equality (`==`)
- Prefer `import type { ... }` for type-only imports to avoid runtime overhead
- Use `const` assertions (`as const`) for literal types and immutable arrays/objects
- Avoid `enum` in new code — prefer `const` objects with `as const` or string union types
- Keep generic type parameters descriptive when non-obvious (`TItem` > `T` if >1 generic)
- Run the project's configured linter (`eslint`) and type checker (`tsc --noEmit`) after changes
- For esbuild projects: remember esbuild strips types but doesn't type-check — always verify with `tsc`
