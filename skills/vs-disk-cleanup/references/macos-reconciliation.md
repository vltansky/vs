# Reconcile macOS storage

Use native macOS tools. Record the baseline before any cleanup. Keep the logs and exact candidate paths in the same scratchpad.

```sh
df -k /System/Volumes/Data
diskutil apfs list
diskutil apfs listSnapshots /System/Volumes/Data
tmutil listlocalsnapshots /
mdutil -s /System/Volumes/Data
```

Identify the APFS container that owns `/System/Volumes/Data`. Record the container allocation, shared free space, and consumed bytes by volume. Report Data, VM swap and other volumes separately. APFS volumes share container capacity. Simulator images mounted as separate volumes can have backing files on Data, so adding their mounted filesystem totals double-counts storage. [Apple APFS volume documentation](https://support.apple.com/guide/disk-utility/dskua9e6a110/mac)

Run the file walk in the background and log its status and stderr. Start with depth two to surface large branches such as `private/tmp`. Compare the Data root total with APFS's consumed bytes for that same volume, converting `du -k` KiB to bytes.

```sh
du -x -k -d 2 /System/Volumes/Data > "<scratchpad>/data.tsv" 2> "<scratchpad>/data.errors"
```

Wait for the command to exit. If it emits a final root row and permission errors, mark the result partial and report the apparent difference and unreadable scopes. If the root row is missing, report the file total as unavailable. APFS metadata, clones, inaccessible files and concurrent writes affect the comparison. The difference cannot measure an individual hidden directory. [Apple file system features](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/APFS_Guide/Features/Features.html)

## Spotlight and other protected usage

- Record index status and, if useful, test a known file with `mdfind`. A read-only status, missing search result or empty log search alone cannot diagnose corruption or quantify the index.
- Measure the allocated sizes of accessible Spotlight stores. Check `.Spotlight-V100` on the Data volume and `private/var/db/Spotlight*` on the same volume where present. If access is denied, report index size and health as unverified. A follow-up can use an authorized administrator session with the required disk access. Keep permission changes and index rebuilds outside the audit.
- Check whether snapshots actually exist on Data. The sealed system snapshot and ordinary VM swap belong to other volumes. Keep system-managed files and snapshots out of the cleanup candidates.
- Clear verified storage pressure first. If search still fails, use the supported reindex procedure with the user's approval. [Apple Spotlight guidance](https://support.apple.com/102321)

## Find candidates while preserving projects

- Use the dev-leftovers inventory and targeted `du -xsk` on the largest visible branches. Inspect large temporary directories for live agent sessions, signed build evidence, source copies and other project state. A temporary path alone gives no evidence that its contents are disposable.
- For each proposed path, identify its owner and how the owner regenerates it. Check file recency, process working directories, command-line paths and open files. Inspect launchers and project configuration for paths that an idle process may need later. Inside Git, require an ignored path and zero tracked descendants. An old modification time or a quiet `lsof` result alone is insufficient.
- Split generated intermediates from products when their layout permits it. For Xcode, inspect the launcher and preserve `Build/Products`, signed apps, simulator state and active build roots. An idle `Build/Intermediates.noindex`, module cache or index can be offered separately after checking that retained products do not point into it. Recheck the exact paths before cleanup and verify the retained products afterward.
- Inspect model caches by model or revision and identify open files and configured consumers. Retain models referenced by active tools. List the allocated size, restore source and offline-use impact of each optional model. Age and repository-wide text searches cannot rule out dynamic or offline use.
- Rank by measured size and user impact. Give exact paths, the evidence for regenerability, what the next build or install may need, and the before/after `df` check. If the user approved a single batch, stop after verifying it. A new batch needs its own scope.
