# Copilot Workspace Instructions

These instructions apply to ALL interactions in this workspace.

## Communication

- Be direct, concise, skip unnecessary framing
- Never announce tool names — describe actions naturally
- After completing file operations, confirm briefly instead of explaining what was done
- Use tables for comparisons, bullet lists for steps

## Code Style

- Match the project's existing patterns, indentation, and naming conventions before writing new code
- Prefer readability over cleverness — write code a junior dev can understand
- Add comments only for "why", never for "what" (the code itself should explain what)
- Use descriptive variable names; avoid single-letter names outside loops
- Keep functions under ~40 lines; extract when longer

## Git Discipline

### Branching
- Work directly on `main` for small, safe changes (single-file tweaks, version bumps, doc updates)
- Use feature branches (`git checkout -b feature/description`) for multi-file or risky changes
- Branch naming: `feature/`, `fix/`, `refactor/`, `docs/` prefixes

### Commit Messages
- Format: `Short imperative summary` — describe what the commit does, not what you did
- Good: `Add PouchDB Server backend`, `Fix status bar error state`, `Bump version to 0.2.11`
- Bad: `fixed stuff`, `update`, `wip`, `bump`
- One logical change per commit — don't mix unrelated changes
- Commit after each working milestone, not in huge batches

### Versioning
- Use semantic `MAJOR.MINOR.PATCH` format (e.g. `0.2.11`)
- Bump version in ALL version files simultaneously: `manifest.json`, `package.json`, `versions.json` (and `manifest-beta.json` if applicable)
- Update `updates.md` changelog with structured entries before deploying
- Changelog entry format: `- **Type**: Description` where Type is one of:
  - `Bugfix` — fixes to existing behavior
  - `Performance` — speed or resource optimization
  - `UX` — user-facing improvements
  - `New` — new features or files
  - `Refactor` — internal restructuring without behavior change
  - `Cleanup` — dead code removal, import cleanup
  - `Security` — security hardening
  - `Compliance` — standards adherence (accessibility, CSP, etc.)
  - `Note` — migration notes or breaking change warnings
- Tag releases when publishing: `git tag 0.X.Y && git push --tags`

### Things to Never Commit
- Debug/test files, `.env` files, secrets
- `node_modules/`, build artifacts (unless explicitly tracked)
- Temporary or scratch files (`suggestions.txt`, `*.tmp`)

## Build & Deploy

- Build: `npm run build` (production) or `npm run dev` (watch mode)
- Deploy locally: `npm run build:deploy` (builds + copies to local plugin directory)
- Build output goes to `dist/` or directly to the configured deploy path
- Always verify build succeeds before committing version bumps

## Error Handling

- When encountering an error, investigate the root cause — don't just patch symptoms
- Check actual database schemas, file contents, and runtime behavior before assuming
- Always verify fixes work (HTTP status, test output, or CLI check) before declaring done

## Testing

- Run existing tests after every code change
- When creating new functionality, add corresponding tests
- Smoke-test affected pages/routes/endpoints after modifications
- Verify backward compatibility when refactoring
- Unit tests: `npm run test:unit` (Vitest, no external services needed)
- Integration tests: `npm run test` (requires test services)

## Security Defaults

- Never hardcode credentials, API keys, or secrets in source files
- Use environment variables or `.env` files (gitignored) for sensitive config
- Sanitize user inputs, use parameterized queries (no string concatenation for SQL)
- Use `password_hash()` / `password_verify()`, never MD5/SHA1 for passwords
