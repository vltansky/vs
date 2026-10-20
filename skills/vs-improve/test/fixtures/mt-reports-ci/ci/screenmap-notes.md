# Screenmap (mobile PR screenshots)

Captures the screens a mobile PR affects on an Android emulator and posts them
as a PR comment. It never blocks merge on a screen difference; it only fails
when the job itself breaks.

Cost drivers: a Gradle/dev-client cache miss rebuilds the APK (20–31 min on the
2-core runner); a hit restores in ~6s. `eas upload` runs on every run.
