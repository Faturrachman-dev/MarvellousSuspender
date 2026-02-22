---
applyTo: "**/*.{svelte}"
---

# Svelte Instructions

- Check if the project uses Svelte 4 or Svelte 5 (runes) before writing components
- Svelte 4: use `export let prop` for props, `$:` for reactive statements, `{#if}` blocks for logic
- Svelte 5: use `$props()`, `$state()`, `$derived()`, `$effect()` runes — don't mix with Svelte 4 syntax
- Keep components under ~150 lines — extract child components when larger
- Use `{#each items as item (item.id)}` with keys for list rendering
- Prefer `bind:value` for two-way binding on form inputs; use `on:input` for one-way data flow
- Use Svelte stores (`writable`, `readable`, `derived`) for shared state across components
- Avoid direct DOM manipulation — use Svelte's reactive system instead
- Use `{@html ...}` sparingly and only with sanitized content to prevent XSS
- For component libraries: export types alongside components for TypeScript consumers
- Use `<slot>` for component composition; named slots for complex layouts
- Place component styles in `<style>` blocks — they're scoped by default
- Import `.svelte` components with PascalCase names matching the filename
