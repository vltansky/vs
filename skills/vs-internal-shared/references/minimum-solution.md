# Minimum Solution Gate

After understanding the affected flow, take the first rung that completely
satisfies the request:

1. Avoid new code when the behavior already exists or is unnecessary.
2. Reuse the repository's helper, type, component, convention, or configuration.
3. Use the language standard library.
4. Use the native platform: browser, CSS, database, or operating system.
5. Reuse an installed dependency.
6. Keep a clear expression on one line; do not expand it for formatting alone.
7. Write the smallest local implementation that completes the work.

Before choosing standard-library, platform, dependency, or local code, check
the affected area once for a repository helper and reuse it when it fits. Then
choose, implement, and stop searching or comparing alternatives.

Minimize concepts, files, dependencies, branches, and configuration—not merely
line count. Between equally clear and correct solutions, prefer fewer changed
lines. Preserve requested behavior, trust-boundary validation, data-loss
prevention, security, accessibility, repository-required tests, and necessary
error handling. Skip speculative abstractions and unrequested extensibility.

Use the gate to reduce solution machinery, never understanding, research,
evidence, verification, safety, or an explicit user requirement.
