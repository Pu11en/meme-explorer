# Batch 001 iMac handoff

This handoff transfers the four Batch 001 recordings and the existing Batch 001 analysis outputs from Drew's current Linux machine to the iMac. The repository is private, and the 435 MiB data archive is stored as a private GitHub release asset rather than in Git history.

## Contents

The archive contains 58 files totaling 3,916,097,642 bytes (3.65 GiB extracted):

| Run | Duration | Raw records | Normalized records | Files | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `run-0001-20260901T090521.931Z` | 5 min | 210,305 | 577,396 | 9 | 733,823,174 |
| `run-0002-20260902T213813.900Z` | 10 min | 369,103 | 1,063,031 | 9 | 1,333,670,931 |
| `run-0003-20260904T012430.686Z` | 10 min | 342,146 | 1,011,795 | 9 | 1,269,749,728 |
| `run-0004-20260904T025702.891Z` | 5 min | 153,319 | 458,824 | 9 | 568,285,093 |

Each run includes its manifest, raw PumpAPI recording, and all normalized outputs, including reliability. The four `blobs/` directories are empty and the raw recordings contain no `blob_ref` objects, so no blob payloads are required or missing.

The remaining 22 files are seven existing `ten-second-buy-activity` analysis results. The machine-readable [inventory](./inventory.json) lists every included path, size, and SHA-256 checksum.

## Verified release asset

- Branch: <https://github.com/Pu11en/meme-explorer/tree/handoff/batch-001-imac>
- Release: <https://github.com/Pu11en/meme-explorer/releases/tag/batch-001-imac-v1>
- Direct archive link: <https://github.com/Pu11en/meme-explorer/releases/download/batch-001-imac-v1/batch-001-imac-v1.tar.zst>
- Release tag: `batch-001-imac-v1`
- Archive: `batch-001-imac-v1.tar.zst`
- Compressed size: 455,129,637 bytes (434.0 MiB)
- Extracted file size: 3,916,097,642 bytes (3.65 GiB)
- Archive SHA-256: `7e39232f64cc23b08b96a274759b8a40287fb3e54740b5f3731a2756c7a966ca`
- Parts: 1; splitting was not required because the archive is below 1 GiB

Before upload, the archive passed `zstd -t`, contained exactly 58 file members, and all 58 extracted files matched `files.sha256`. Manifest record counts match the corresponding recordings, and every run has `latest_raw_seq == durable_raw_seq`. A targeted scan found no GitHub, OpenAI, AWS, or PEM private-key patterns in the selected files.

## Download and verify on macOS

These commands assume Homebrew is available and the current directory is where the repository should live.

```bash
brew install gh zstd
gh auth login
git clone --branch handoff/batch-001-imac --single-branch git@github.com:Pu11en/meme-explorer.git
cd meme-explorer

mkdir -p .handoff-download/batch-001-imac-v1
gh release download batch-001-imac-v1 \
  --repo Pu11en/meme-explorer \
  --dir .handoff-download/batch-001-imac-v1

cd .handoff-download/batch-001-imac-v1
shasum -a 256 -c archive.sha256
cd ../..
```

Expected archive verification output:

```text
batch-001-imac-v1.tar.zst: OK
```

Extract into a temporary directory, verify every data file there, then install the verified `data/` tree into the repository:

```bash
REPO_ROOT="$PWD"
DOWNLOAD_DIR="$REPO_ROOT/.handoff-download/batch-001-imac-v1"
EXTRACT_DIR="$(mktemp -d -t batch-001-imac-v1)"

zstd -dc "$DOWNLOAD_DIR/batch-001-imac-v1.tar.zst" | tar -xf - -C "$EXTRACT_DIR"
cd "$EXTRACT_DIR"
shasum -a 256 -c "$DOWNLOAD_DIR/files.sha256"

rsync -a "$EXTRACT_DIR/data/" "$REPO_ROOT/data/"
cd "$REPO_ROOT"
shasum -a 256 -c "$DOWNLOAD_DIR/files.sha256"
```

Both checksum commands must report `OK` for all 58 files. The final command verifies the installed copy, not merely the temporary extraction. Keep the downloaded archive until the iMac analysis build has been validated.

## Dependencies and exclusions

The transfer requires authenticated access to the private `Pu11en/meme-explorer` repository, Git, GitHub CLI, Zstandard, `tar`, `rsync`, and macOS `shasum`. No recorder process needs to be started or changed.

No credentials, environment files, unrelated runs, or unrelated analysis datasets are included. No source files were modified. Nothing is missing from the selected Batch 001 scope.

## Downstream use

After the final checksum succeeds, Batch 001 is ready for the iMac agent to build and validate the six first-minute batch filters. This handoff does not change the confirmed outcome rule: success is a verified market-cap hit of at least $30,000 within three hours, and migration remains informational rather than the success criterion.
