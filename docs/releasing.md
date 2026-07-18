# Releasing

Version numbers are kept aligned across the four public packages.

1. Update package versions and `CHANGELOG.md`
2. Run `pnpm verify` and `pnpm test:e2e`
3. Commit the release state
4. Create and push an annotated `vX.Y.Z` tag
5. Let the release workflow rebuild and validate every package

The workflow creates `.tgz` artifacts for each package and attaches them to a GitHub release. It does not publish to npm. npm publishing requires a separate reviewed decision after the pre-1.0 API has received feedback.
