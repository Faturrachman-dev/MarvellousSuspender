---
applyTo: "**/*.{sql,migration}"
---

# Database Instructions

- Verify table schemas before writing queries — don't assume column or key names
- Use parameterized queries / prepared statements — never concatenate user input into SQL
- Prefer explicit column lists over `SELECT *` for production queries
- Use transactions for multi-statement operations that must succeed or fail together
- Add indexes for columns used in WHERE, JOIN, and ORDER BY clauses
- Back up data before running destructive operations (DROP, TRUNCATE, bulk UPDATE/DELETE)
- Test queries on a local copy before running on production
- When using an ORM: check generated SQL for N+1 queries and unnecessary joins
- For migrations: make them reversible (include both up and down), never edit already-applied migrations
- Use `EXPLAIN` / `EXPLAIN ANALYZE` to verify query plans for slow queries
