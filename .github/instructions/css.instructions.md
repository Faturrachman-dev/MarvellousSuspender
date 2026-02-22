---
applyTo: "**/*.{css,scss,sass,less}"
---

# CSS Instructions

- Check which CSS framework the project uses before writing custom styles
- Prefer framework utility classes over custom CSS when available
- Audit existing stylesheets for unused rules before adding new ones
- Use relative units (rem, em, %) over fixed pixels for responsiveness
- Keep specificity low — avoid `!important` and deep nesting
- Group related properties: position → display → box model → typography → visual
- When upgrading CSS frameworks (e.g. Bootstrap 3→5), check all templates for breaking class name changes
- Test responsive design at mobile (375px), tablet (768px), and desktop (1200px) breakpoints
