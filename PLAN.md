Below is a concrete instruction set you can hand to a strong local agent. It is written to make the agent behave like a careful digital forensics/restoration operator rather than a generic assistant.

---

# Restoration Project Brief: **The Adventures of Alex — Palm Island Mission** CD-ROM

You are running a **dedicated preservation and restoration project** for a damaged physical **CD-ROM** containing an obscure 1996 edutainment/adventure game:

* **Title:** *The Adventures of Alex — Palm Island Mission*
* **Likely medium:** CD-ROM, not DVD
* **Likely publisher/imprint:** Onda Publications Ltd / Eric Cohen Edutainment
* **Observed condition from photos:** significant light-to-medium read-side scratching, concentrated rougher areas in one quadrant, no obvious catastrophic hub crack, no clear evidence yet of label-side delamination from the provided images
* **Constraint:** the disc is likely obscure and not easily obtainable online
* **Primary objective:** recover the original data as faithfully as possible
* **Secondary objective:** reconstruct a runnable installation only if exact recovery is impossible
* **Non-objective:** “AI guessing” of arbitrary missing bytes without format evidence

Your job is to set up a **full local restoration workflow**, run it, document everything, and produce the best possible preserved result.

---

## Core principles

1. **Preservation first, convenience second.**
   Do not mutate the only source irreversibly until non-destructive methods are exhausted.

2. **Capture raw evidence.**
   Prefer whole-disc imaging, sector maps, logs, hashes, drive metadata, and repeated-read statistics over simple file copying.

3. **Exploit hardware variation.**
   Different optical drives produce different outcomes on damaged media. This is central, not optional.

4. **Separate exact recovery from playable reconstruction.**
   Keep these as different deliverables:

   * archival image / best-effort raw dump
   * extracted filesystem
   * repaired runnable version, if feasible

5. **No hallucinated bytes unless justified by structure.**
   Any repaired bytes must come from:

   * repeated-read consensus
   * ECC/EDC-consistent reconstruction
   * known file format redundancy
   * duplicate copies elsewhere on disc
   * externally verified identical edition
     Never invent payload bytes just because they “look plausible”.

6. **Document uncertainty explicitly.**
   Every reconstruction step must record whether it is exact, inferred, or guessed.

---

## Deliverables

Create a project directory, for example:

```text
alex_palm_island_restoration/
  00_admin/
  01_physical_inspection/
  02_drive_inventory/
  03_imaging/
  04_images/
  05_logs/
  06_mount_extract/
  07_analysis/
  08_recovery_attempts/
  09_reconstruction/
  10_final_outputs/
  11_report/
```

Expected outputs:

1. **Project report** in Markdown:

   * disc identity
   * physical condition
   * drive list
   * tools used
   * chronological attempts
   * exact results
   * bad-sector map summary
   * what remains unreadable
   * what was exactly recovered vs reconstructed

2. **Best raw image(s)**:

   * ISO/BIN if obtainable
   * cue/toc if relevant
   * ddrescue / IsoBuster maps / logs

3. **Filesystem extraction** of best image.

4. **Integrity data**:

   * SHA256 for all images and extracted files
   * manifest of missing/corrupt files

5. **Runnable reconstruction**, if possible:

   * original install tree
   * patched or substituted files, if any
   * exact explanation of each modification

6. **Preservation package**:

   * raw image
   * logs
   * metadata
   * photos
   * report

---

## Phase 0 — Environment and tooling

Set up a local environment with tools appropriate to the host OS.

### On Linux, prefer:

* `ddrescue`
* `cdrdao`
* `readom` or `cdrskin`/`cdrecord` family where useful
* `isoinfo`, `7z`, `file`, `binwalk`
* `mount`, loopback support
* `sha256sum`
* `python` for scripting comparison / manifests

### On Windows, prefer:

* IsoBuster
* CloneCD / ImgBurn only if useful for image acquisition metadata
* Any low-level optical read tool that exposes retries and sector status
* Hashing tools
* 7-Zip
* file format inspectors

### Optional:

* Multiple external/internal optical drives
* One older full-size desktop drive if available
* Access to a professional resurfacing machine, but only later

Record versions of all tools used.

---

## Phase 1 — Physical inspection and handling

Create `01_physical_inspection/inspection.md`.

Tasks:

1. Record all visible label text from the disc.
2. Record disc type estimate:

   * likely pressed CD-ROM from 1996
   * not a recordable disc unless evidence suggests otherwise
3. Record visible damage:

   * read-side scratch density
   * any deep radial scratches
   * any circular scratches
   * any hub cracks
   * any label-side pinholes, peeling, ink damage, or delamination
4. Preserve high-resolution photos:

   * front/label
   * back/read side under strong light
   * angled light to show scratch direction
   * inner hub and outer edge close-ups

Do **not** begin with abrasive resurfacing.

### Cleaning procedure

Use the least aggressive safe cleaning first:

* lukewarm water
* tiny drop of mild dish soap
* fingertips only
* rinse thoroughly
* dry with clean microfiber, center-to-edge only

Document whether this was performed before imaging and whether it changed readability.

---

## Phase 2 — Drive inventory and test plan

Create `02_drive_inventory/drives.md`.

For each available drive, record:

* manufacturer/model
* interface (USB/SATA/internal/external)
* firmware if available
* whether tray or slot load
* whether it reads other known-good CDs reliably

Then define a test matrix.

Minimum plan:

* at least 3 different drives if possible
* at least one full-size desktop drive
* at least one slow/older drive if available
* avoid assuming the newest drive is best

Goal: determine which drive gives the most stable TOC/session recognition and lowest unreadable-sector count.

---

## Phase 3 — Imaging strategy

This phase is the core of the project.

### Imaging policy

1. First get the **best possible whole-disc image**, not just file copies.
2. Keep **all logs and maps**.
3. Do multiple passes:

   * fast scrape
   * targeted retries
   * repeated attempts on weak regions
4. Use multiple drives and compare results.

### Preferred Linux workflow

If the disc is readable enough to expose a block device:

* identify the optical device, e.g. `/dev/sr0`
* attempt to read TOC/session info
* create an initial image with `ddrescue`:

  * first pass: no scraping, preserve map
  * second/third passes: retry bad sectors
* retain mapfile between attempts
* run the same image procedure across multiple drives with separate logs and outputs

Example logical stages, not fixed commands:

* pass 1: fast non-splitting copy to get everything easy
* pass 2: retries on failed blocks
* pass 3: scraping / reverse / smaller block strategies if tool supports it

If tool choice permits, also attempt:

* raw sector image
* Mode 1 / cooked ISO read if raw fails
* alternate image formats if TOC suggests mixed-mode or multiple sessions

### Preferred Windows workflow

Use IsoBuster or equivalent to:

* detect sessions/tracks
* image the disc with maximum logging
* retry unreadable sectors conservatively first, then aggressively
* preserve sector error maps
* if offered, extract “good parts only” and also a full sparse/bad-sector image

### Important

If the game is mixed-mode or has audio/data tracks, do not collapse everything into a naive ISO prematurely. Preserve track/session structure if present.

---

## Phase 4 — Multi-drive comparison

Create `03_imaging/comparison.md`.

Compare results across drives:

* could the drive read the TOC?
* did it identify one track or multiple?
* image size
* number of unreadable sectors
* location ranges of failures
* consistency of recovered bytes in overlapping readable regions
* whether bad regions are identical or differ by drive

If two drives recover different parts successfully, attempt to **merge** results conservatively:

* prefer exact readable sectors from one image where another failed
* never overwrite a known-good sector with uncertain data
* log every merged range

Produce a “best composite image” only if merge provenance is explicit.

---

## Phase 5 — Filesystem extraction and inspection

Once the best image exists, mount or inspect it without modifying it.

Tasks:

1. Identify filesystem:

   * ISO9660
   * Joliet
   * mixed structures
   * installer containers
2. Extract directory tree.
3. Generate:

   * full file list
   * sizes
   * timestamps if preserved
   * hashes of extracted files
4. Identify unreadable/corrupt files:

   * extraction failures
   * CRC failures
   * truncated files
   * malformed archives
   * executable corruption

Store results in:

* `06_mount_extract/file_manifest.tsv`
* `06_mount_extract/extraction_log.txt`

---

## Phase 6 — Format-aware analysis

Create `07_analysis/analysis.md`.

Classify recovered files by type:

* executables (`.exe`, `.dll`)
* installers (`.cab`, InstallShield, MSI, custom archives)
* media (`.wav`, `.mid`, `.avi`, `.bmp`, etc.)
* game data archives
* scripts/text/config
* duplicate resources

For each corrupted file, determine:

1. Is it structurally parseable?
2. Is corruption localized or pervasive?
3. Is the file optional for boot/install?
4. Are there duplicate copies elsewhere on disc?
5. Can headers/indexes be repaired exactly from internal redundancy?
6. Is there external reference material from the same edition?

Use tools like `file`, `7z`, hex inspection, container parsers, and custom scripts.

---

## Phase 7 — Recovery hierarchy

Apply the following recovery order strictly.

### Tier 1 — Exact recovery only

Allowed methods:

* repeated-read consensus
* multi-drive sector merge
* raw vs cooked reread comparison
* image rereads after cleaning
* image rereads after rest/cooldown
* slower drive speed if controllable

### Tier 2 — Structure-based exact inference

Allowed only if justified:

* restore damaged filesystem metadata from duplicate volume descriptors
* repair archive headers from identical internal structures
* recover lengths/offsets where payload is fully present and only metadata is damaged
* repair EDC/ECC-consistent sectors when enough exact content exists

### Tier 3 — Functional reconstruction

Only after exact archival attempts are exhausted:

* bypass broken installer if payload files are intact
* replace a corrupt optional intro video or audio file with a stub
* patch configuration or launcher paths
* reconstruct install tree from extracted contents
* use a donor runtime component only if provenance is clear and version matched

### Tier 4 — External donor sourcing

Look for:

* identical edition dumps
* another physical copy
* archived installer from same release
* magazines / local abandonware mirrors / preservation communities

If external sources are used:

* record provenance exactly
* keep original recovered data separate
* never silently blend donor data into “recovered original”

### Tier 5 — Heuristic byte guessing

This is almost forbidden.
Only consider it when:

* the damaged region is tiny
* the format is strongly constrained
* there is a deterministic validation criterion
* there is no ambiguity in the reconstructed value

Example acceptable case:

* repairing a length field or checksum after exact payload recovery

Example unacceptable case:

* inventing missing executable or compressed payload bytes because a model thinks they are likely

---

## Phase 8 — Practical runnable reconstruction

If exact archival image still has a few fatal damaged files, attempt a runnable version.

Priority order:

1. determine whether the game can run directly from extracted files
2. determine whether installer failure can be bypassed
3. identify optional/non-essential assets
4. stub or replace only non-core damaged media
5. keep original filenames and directory structure when possible
6. document each deviation from the original

Potential tactics:

* run extracted tree inside an appropriate old Windows VM
* inspect launcher dependencies
* patch absolute paths if needed
* substitute damaged AVI/WAV with benign placeholders only if boot/runtime requires them and original asset is unrecoverable
* keep a “strict original” tree and a separate “functional reconstructed” tree

Do not present reconstructed runnable output as equivalent to original archival recovery.

---

## Phase 9 — Historical and external research

Because the title is obscure, do a dedicated provenance search, but keep it separate from physical recovery.

Research tasks:

* all spelling variants:

  * `The Adventures of Alex`
  * `Palm Island Mission`
  * `Alex Palm Island`
  * publisher/imprint variants
* search by visible label text
* search local-language sources if relevant
* search scans of 1990s software catalogs, educational software lists, Israeli CD-ROM publishers, archived retail listings
* search preservation communities and old software archives
* search images rather than only text, in case title OCR is poor

If a donor copy is found:

* verify edition match by label art, publisher, date, and file layout
* preserve distinction between donor and recovered data

---

## Phase 10 — Validation

For each final artifact, answer:

1. Is this an exact image of what the disc currently yields?
2. Is this a composite exact image from multiple drives?
3. Is this an extracted filesystem with some unreadable files?
4. Is this a reconstructed runnable version?
5. What remains uncertain?

Validation tasks:

* hash all final artifacts
* test mounting of image
* test extraction repeatability
* test game startup in period-appropriate environment if possible
* log every failure path

---

## Phase 11 — Reporting

Produce `11_report/final_report.md` with sections:

1. **Disc identification**
2. **Physical condition**
3. **Toolchain**
4. **Drive comparison**
5. **Imaging results**
6. **Recovered filesystem summary**
7. **Corruption analysis**
8. **Exact recovery steps**
9. **Reconstruction steps**
10. **Final deliverables**
11. **What is exact / inferred / replaced**
12. **Recommended next actions**

Be blunt about uncertainty. A partial exact recovery is better than a vague claim of success.

---

## Concrete execution checklist

Use this as the operational checklist:

### A. Intake

* [ ] create project directory
* [ ] copy all photos into project
* [ ] write intake summary from visible evidence
* [ ] list available drives and OS/tool options

### B. Safe preparation

* [ ] gentle cleaning
* [ ] dry completely
* [ ] re-photograph if needed

### C. Initial drive probing

* [ ] attempt TOC/session read on each drive
* [ ] record which drives recognize the disc
* [ ] note stalls, noises, repeated seeking

### D. Imaging

* [ ] image with drive 1, pass 1
* [ ] retries with drive 1
* [ ] image with drive 2
* [ ] image with drive 3
* [ ] preserve all logs/maps
* [ ] compare unreadable regions

### E. Composite recovery

* [ ] merge only exact readable regions from alternate images
* [ ] produce best composite image with provenance log

### F. Extraction

* [ ] inspect filesystem
* [ ] extract files
* [ ] identify corrupt/unreadable files
* [ ] generate manifest and hashes

### G. Analysis

* [ ] classify file types
* [ ] find duplicates / redundant copies
* [ ] determine installer vs payload damage
* [ ] check whether damaged files are optional

### H. Reconstruction

* [ ] attempt direct-run tree if installer damaged
* [ ] create minimal functional reconstruction only if justified
* [ ] keep strict separation from archival output

### I. External search

* [ ] search for identical edition donor
* [ ] verify provenance if found

### J. Finalization

* [ ] write final report
* [ ] hash all outputs
* [ ] summarize exactness and remaining gaps

---

## Behavior requirements for the agent

* Think like a preservation engineer, not a chatbot.
* Do not skip logging.
* Do not claim a file is “recovered” if it is merely present but corrupted.
* Do not use generative AI to synthesize software payloads without strict deterministic validation.
* When blocked, produce the best partial state and explain precisely what prevents further progress.
* Prefer exactness over optimism.

---

## Final success criteria

### Best-case success

* exact or near-exact full-disc image recovered
* filesystem extracted cleanly
* game runs from recovered media or install tree

### Moderate success

* most files recovered
* only a few damaged media assets missing
* runnable reconstructed version produced with explicit substitutions

### Minimal success

* archival image with sector map
* partial extraction
* clear identification of unrecoverable regions and which files they affect

### Failure

Only call it failure if:

* multiple drives and imaging methods were tried,
* physical condition was documented,
* logs/maps were preserved,
* and the unreadable regions prevent both exact recovery and any honest functional reconstruction.

