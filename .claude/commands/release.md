---
description: Create a new release - updates version numbers, creates git tag, and pushes to GitHub
argument-hint: <version>
allowed-tools: Read, Edit, Bash(git:*)
---

# Release Process Automation

Automates the JSync release process by updating version numbers across all required files, creating a git commit and tag, and pushing to GitHub.

## Usage

```bash
/release 0.2.2
/release v0.2.2   # v prefix is optional
```

## What This Command Does

1. **Validates** the version format (must be semver: X.Y.Z)
2. **Updates version** in all 4 required files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   - `src/App.tsx`
3. **Shows you a preview** of all changes
4. **Asks for confirmation** before proceeding
5. **Creates git commit** with message "Bump version to X.Y.Z"
6. **Creates git tag** vX.Y.Z
7. **Pushes** both commits and tag to GitHub
8. **Triggers GitHub Actions** to build and publish the release

## Instructions for Claude

When invoked with version parameter `$1`:

### Step 1: Validate Version Format
- Strip "v" prefix if present from `$1`
- Validate format matches X.Y.Z (semver)
- If invalid, show error and stop

### Step 2: Update Version Files

Update the following files with the new version number:

1. **package.json**: Update `"version"` field
2. **src-tauri/tauri.conf.json**: Update `"version"` field
3. **src-tauri/Cargo.toml**: Update `version` in `[package]` section
4. **src/App.tsx**: Update version display string `"vX.Y.Z"` in the preferences view footer

### Step 3: Preview Changes
Run `git diff` to show the user exactly what will change.

### Step 4: Confirm with User
Ask the user: "Ready to commit and push release X.Y.Z? This will trigger GitHub Actions to build and publish."

Provide options:
- Yes (proceed with release)
- No (cancel)

### Step 5: Execute Release (only if confirmed)

```bash
# Stage changes
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src/App.tsx

# Commit
git commit -m "Bump version to X.Y.Z"

# Create annotated tag
git tag vX.Y.Z

# Push commits and tag
git push origin main
git push origin vX.Y.Z
```

### Step 6: Verify Success
- Show the git log to confirm commit was created
- Confirm tag was pushed
- Remind user that GitHub Actions will now build the release

## Safety Features

- Always strip and validate version format before making changes
- Never proceed without explicit user confirmation
- Show full diff of changes before committing
- Use atomic git operations to ensure consistency
