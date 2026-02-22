---
description: "Wrap up a development session by checking for leaks, bumping the version, and updating documentation."
authors: ["GitHub Copilot"]
---

# Wrap-up Workflow

You are an expert AI programming assistant. The user has just finished a development session and wants to wrap up the work. Please follow these steps in order:

1. **Recheck the Codebase for Leaks**:
   - Review the files that were modified during the session (e.g., `background.js`, `gsTabSuspendManager.js`, `gsTabQueue.js`).
   - Look for memory leaks, unclosed database connections, event listeners added inside loops, or indefinitely growing arrays/objects.
   - If any leaks or inefficiencies are found, fix them and explain the changes.

2. **Bump the Version**:
   - If the codebase is well-managed and no major issues are found, bump the version number.
   - Update the version in ALL relevant files simultaneously (e.g., `package.json`, `src/manifest.json`, `versions.json`, `manifest-beta.json`).
   - Follow semantic versioning (`MAJOR.MINOR.PATCH`).

3. **Update the Changelog**:
   - Update the `updates.md` (or `CHANGELOG.md`) file with structured entries describing the changes made during the session.
   - Use the format: `- **Type**: Description` (where Type is `Bugfix`, `Performance`, `UX`, `New`, `Refactor`, `Cleanup`, `Security`, `Compliance`, or `Note`).

4. **Update Documentation and Instructions**:
   - Reflect on the lessons learned from this development session (e.g., performance tuning, logging best practices, legacy code removal).
   - Update the `.github/copilot-instructions.md` file or relevant documentation to include these new insights and best practices.

5. **Final Review**:
   - Run the test suite (`npm run test`) and build script (`npm run build`) to ensure everything is stable.
   - Provide a concise summary of the actions taken.
