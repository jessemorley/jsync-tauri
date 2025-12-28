# Release Process

This document outlines the steps required to push a new release of JSync.

## Pre-Release Checklist

- [ ] All changes are committed and pushed to `main`
- [ ] Application has been tested locally
- [ ] CHANGELOG or commit messages are up to date

## Version Number Updates

Update the version number in the following files:

### 1. `package.json`
```json
{
  "version": "X.Y.Z"
}
```

### 2. `src-tauri/tauri.conf.json`
```json
{
  "version": "X.Y.Z"
}
```

### 3. `src-tauri/Cargo.toml`
```toml
[package]
version = "X.Y.Z"
```

### 4. `src/App.tsx`
Update the version display in the preferences view footer:
```tsx
{view === "prefs" ? "vX.Y.Z" : sessionInfo.lastSyncLabel}
```

## Release Steps

### 1. Update Version Numbers
Update all four files listed above with the new version number.

### 2. Commit Version Bump
```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src/App.tsx
git commit -m "Bump version to X.Y.Z"
```

### 3. Create Git Tag
```bash
git tag vX.Y.Z
```

### 4. Push to GitHub
```bash
# Push commits
git push origin main

# Push tag
git push origin vX.Y.Z
```

### 5. GitHub Actions (Automatic)
Once the tag is pushed, GitHub Actions will automatically:
- Build the application for macOS
- Create a GitHub Release
- Upload the `.dmg` installer as a release asset
- Generate release notes from commits

### 6. Verify Release
- Check GitHub Releases page to confirm the release was created
- Download and test the `.dmg` installer
- Verify the auto-updater detects the new version

## Version Numbering

We follow Semantic Versioning (semver):

- **MAJOR** (X.0.0): Breaking changes or major feature additions
- **MINOR** (0.Y.0): New features, backwards compatible
- **PATCH** (0.0.Z): Bug fixes and minor improvements

## Rollback

If a release needs to be rolled back:

1. Delete the tag locally and remotely:
```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

2. Delete the GitHub Release (manual via GitHub UI)

3. Revert version numbers to previous version

4. Create a new patch release with the fix
