---
applyTo: "**/*.{py,pyw}"
---

# Python Instructions

- Follow PEP 8 — `snake_case` for functions/variables, `PascalCase` for classes
- Prefer `pyproject.toml` for project config; check existing dep files before adding packages
- Use virtual environments (`venv`, `uv`, or project's tool) — never install globally
- Use type hints for function signatures; `from __future__ import annotations` for modern syntax
- Handle exceptions specifically — avoid bare `except:` clauses
- Use f-strings over `.format()` or `%` formatting
- Use `pathlib.Path` over `os.path` for file operations
- Prefer `async`/`await` for IO-bound operations in async frameworks (FastAPI, etc.)
- Use environment variables for secrets — `python-dotenv` or `os.environ`
- For web frameworks (Django/Flask/FastAPI): follow the project's existing patterns
- Run linters after changes — prefer `ruff` (fast, replaces flake8+isort+pyupgrade), fallback to `pylint`
- Run linters (`ruff`, `flake8`, or `pylint`) after making changes
