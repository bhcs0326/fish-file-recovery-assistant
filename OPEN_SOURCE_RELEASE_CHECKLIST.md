# Open Source Release Checklist

## Before Publishing

1. Replace the placeholder copyright owner in `COPYRIGHT.md` if needed.
2. Confirm the fish logo can be publicly redistributed.
3. Review `THIRD_PARTY_NOTICES.md`.
4. Decide whether you want to:
- publish source only
- publish source + installer
- publish source + third-party tool bundle
5. If bundling third-party binaries, do a final license review per upstream.

## Repo Hygiene

1. Do not publish:
- `node_modules/`
- `dist/`
- runtime logs
- restore outputs
- private local absolute paths in docs that are not intended to stay
2. Check for any personal names, local usernames, or machine-specific paths.

## Suggested First Public Release

Recommended safest first release:

- publish source code repository first
- do not include `tools/` binaries in the repository
- keep WinFR as optional, user-installed
- if you publish an installer, make sure the release notes state which external tools are bundled or required

## Good Release Files

At minimum:

- `README.md`
- `LICENSE`
- `COPYRIGHT.md`
- `THIRD_PARTY_NOTICES.md`
- `docs/鱼老师文件恢复助手-使用说明.md`

## After Publishing

1. Add a GitHub release note
2. Add issue templates if you want structured bug reports
3. Add a screenshot section to the repository README
