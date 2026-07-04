# Contributing

## Commit message rules

This repository uses Conventional Commits because release notes are generated with `git-cliff`.
Keep commit subjects short, imperative, and lower-case after the type unless a proper noun requires
capitalization.

Use this form:

```text
<type>[optional-scope]: <summary>
```

Examples:

```text
feat: add release preparation workflow
fix: require release bot token for release workflows
docs: document release token setup
test: add release automation coverage
ci: pin checkout action in workflows
chore: release v0.2.9
```

Allowed types:

| Type | Release-note section | Use for |
| --- | --- | --- |
| `feat` | Added | User-visible features or new capabilities |
| `fix` | Fixed | Bug fixes and behavior corrections |
| `perf` | Changed | Performance improvements |
| `refactor` | Changed | Internal restructuring without behavior change |
| `docs` | Documentation | Documentation-only changes |
| `test` | Testing | Test-only changes |
| `ci` | Maintenance | GitHub Actions or CI changes |
| `build` | Maintenance | Build/package tooling changes |
| `chore` | Maintenance | Repo maintenance and release commits |
| `revert` | Reverted | Reverts |

Breaking changes must use either `!` after the type/scope or a `BREAKING CHANGE:` footer:

```text
feat!: change package manifest layout

BREAKING CHANGE: package consumers must update their install path.
```

Avoid vague subjects such as `update stuff`, `fix tests`, or `misc cleanup`. If a commit should not
appear in release notes, it should usually be squashed into the relevant conventional commit before
merge rather than hidden by a non-conventional subject.

## Pull requests

- Keep PRs focused on one concern.
- Include validation performed, usually `bash tests/run-all.sh`.
- Prefer PR titles that also follow Conventional Commit style when squash-merging is used.
- Do not merge release PRs until the generated changelog section has been reviewed and edited if
  necessary.

## Release notes

`git-cliff` reads conventional commit types and writes the `CHANGELOG.md` release section during the
Prepare Release workflow. If release notes look wrong, fix the underlying commit/PR title pattern or
edit the generated release PR changelog before merging.
