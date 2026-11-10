# Releasing Makecord

A release has two parts: the desktop app, which GitHub Actions builds for every platform, and the npm packages that bots need to run outside the IDE.

## 1. Set the version

```bash
pnpm set-version 0.2.0
```

This updates every `package.json`, the runtime's built-in version, the core plugin and the dependency in the new project template. Commit the change on `main`.

## 2. Publish the npm packages

Projects created by the IDE depend on `@makecord/runtime`, so publish the packages before the app:

```bash
npm login
pnpm build
pnpm publish-packages
```

This publishes `@makecord/spec`, `@makecord/plugin-sdk`, `@makecord/plugin-core` and `@makecord/runtime` with public access. pnpm replaces the `workspace:*` dependencies with the real version.

## 3. Build the app

```bash
git tag v0.2.0
git push origin main v0.2.0
```

The **Release** workflow builds Linux (AppImage and .deb), Windows (installer) and macOS (dmg for Apple Silicon and Intel) on GitHub's machines and uploads them to a draft release named after the tag. Open the draft on GitHub, write the notes and publish it.

Installed apps on Windows and Linux AppImage check GitHub Releases every few hours, download new versions in the background and offer a restart.

## Known limitations

- The macOS build isn't signed or notarized. macOS says the app "is damaged" until it's opened once with right-click › Open, or after `xattr -cr /Applications/Makecord.app`. Updates on macOS have to be downloaded by hand.
- The .deb doesn't update itself.

## Checking a build locally

```bash
pnpm --filter @makecord/desktop package --linux AppImage --publish never
```

The result is in `apps/desktop/release/`.
