# Third-Party Tools Placeholder

This open-source preparation folder intentionally does not include bundled third-party recovery binaries.

That means the following tools are expected to be obtained separately from their official upstream sources:

- TestDisk / PhotoRec
- The Sleuth Kit (TSK)
- Windows File Recovery (optional)

## Recommended Sources

- TestDisk / PhotoRec:
  https://www.cgsecurity.org/
- The Sleuth Kit:
  https://www.sleuthkit.org/sleuthkit/
- Windows File Recovery:
  https://support.microsoft.com/en-au/windows/windows-file-recovery-61f5b28a-f5b8-3cc2-0f8e-a63cb4e1d4c4

## Why They Are Not Included Here

- to keep the public source repository cleaner
- to reduce binary size
- to avoid avoidable redistribution ambiguity during the first open-source release

If you later decide to publish a binary release that bundles these tools, review `THIRD_PARTY_NOTICES.md` first.
