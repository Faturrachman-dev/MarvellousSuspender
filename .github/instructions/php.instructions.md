---
applyTo: "**/*.php"
---

# PHP Instructions

- Use PDO with prepared statements for all database queries — never concatenate user input
- Wrap database operations in try/catch — log errors, don't expose details to users
- Use `password_hash()` / `password_verify()` — never MD5 or SHA1 for passwords
- Use `htmlspecialchars()` when outputting user-supplied data to HTML
- Use Composer autoloading (`PSR-4`) when the project has `composer.json`
- Prefer typed properties and return types (PHP 8.0+): `function foo(string $bar): int`
- Use `match` expressions over complex `switch` blocks (PHP 8.0+)
- Use `readonly` properties for immutable data (PHP 8.1+)
- Use environment variables or `.env` files for config — not global variables or hardcoded values
- Test with both `php -l` (syntax) and actual HTTP requests (runtime behavior)
