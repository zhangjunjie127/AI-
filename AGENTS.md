## Git

- Prefer small PRs focused on one feature, one bug fix, one chore, or one refactor.
- Use branches:
  - `feat/<short-name>`
  - `fix/<short-name>`
  - `chore/<short-name>`
  - `refactor/<short-name>`
  - `docs/<short-name>`
- Use Conventional Commit style for PR titles:
  - `feat(editor): add marquee selection`
  - `fix(runtime): handle missing tween state`
  - `docs(agents): update collaboration rules`
- PR descriptions must include:
  - What changed
  - Why it changed
  - How it was checked

## Scene Editor Changes

- Treat requested editor changes as changes to the existing scene editor. Preserve current behavior and confirmed features unless the user explicitly asks to change them.
- Verify the complete user-facing interaction in the running editor whenever feasible; passing unit tests or a build alone is not sufficient to claim the feature is verified.
- Test both Chinese and English display modes when text, labels, or source-backed values are involved. Keep translated display text distinct from the original value stored in project source.
- Check adjacent workflows and regressions before finishing, and state clearly which checks were performed and any manual verification that remains.
