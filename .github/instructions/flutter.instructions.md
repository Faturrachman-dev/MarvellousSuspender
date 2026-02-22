---
applyTo: "**/*.{dart}"
---

# Flutter / Dart Instructions

- Follow Dart effective style guide — use `lowerCamelCase` for variables, `UpperCamelCase` for types
- Check `pubspec.yaml` before adding packages — avoid duplicates
- Prefer `StatelessWidget` when no state management is needed
- Use `const` constructors wherever possible for widget performance
- Keep widget trees shallow — extract child widgets into separate classes at ~50 lines
- Handle loading and error states explicitly in async UI
- Use named routes or a routing package (go_router) for navigation
- Test on both Android and iOS — check platform-specific permissions
- Use environment configs for API endpoints — separate dev/staging/production
- Run `flutter analyze` after changes to catch lint issues
