# Third-Party Notices

This file is a practical release-preparation note for third-party components used or expected by this project.

It is not legal advice. Before public release, do one more manual review against the official upstream license texts.

## 1. TestDisk / PhotoRec

Official upstream:

- https://www.cgsecurity.org/
- https://www.cgsecurity.org/testdisk_doc/index.html
- https://www.cgsecurity.org/testdisk.pdf

What the official docs say:

- TestDisk & PhotoRec are free and open-source data recovery utilities.
- Official documentation also states they are distributed under the GNU General Public License v2 or later.

Practical release implication:

- If you redistribute bundled copies of TestDisk / PhotoRec, keep the upstream copyright and license notices.
- Include the GPL license text with your distribution.
- Make the corresponding source code for the redistributed version available in a GPL-compliant way.

Current safer choice in this open-source prep folder:

- do not include their binaries here
- instruct users to obtain them from the official upstream source

## 2. The Sleuth Kit (TSK)

Official upstream:

- https://www.sleuthkit.org/sleuthkit/
- https://www.sleuthkit.org/sleuthkit/licenses.php

What the official site says:

- TSK source code is distributed under several licenses
- each source file identifies the applicable license
- the basic overview mentions IBM Public License / Common Public License for core code
- some utilities have other licenses
- a stripped copy of GNU `strings` is GPL 2 and standalone

Practical release implication:

- Do not assume TSK is under one single license for every file.
- If you redistribute TSK source or binaries, keep upstream notices and review the upstream `licenses/README.md`.
- In a public repo, it is safer to avoid shipping TSK binaries until you finalize how you want to handle the notices.

Current safer choice in this open-source prep folder:

- do not include TSK binaries here
- document expected tool locations separately

## 3. Windows File Recovery (WinFR)

Official reference:

- https://support.microsoft.com/en-au/windows/windows-file-recovery-61f5b28a-f5b8-3cc2-0f8e-a63cb4e1d4c4

What the official support page says:

- Windows File Recovery is available from the Microsoft Store

Practical release implication:

- This project should treat WinFR as an optional dependency that users install separately.
- Do not place WinFR binaries in the open-source prep repository unless you have separately confirmed redistribution rights.

Current safer choice in this open-source prep folder:

- WinFR is not included
- README and tool docs should tell users to install it separately if needed

## 4. Electron / electron-builder / npm dependencies

These dependencies are governed by their own upstream licenses.

Practical release implication:

- When publishing source code, keep `package.json` and `package-lock.json`
- If you later publish binary releases broadly, consider generating a dependency notice report

## 5. Project Assets

The fish logo and project branding should only be published if you own the rights or have permission to release them publicly.

Before public release, confirm:

- logo ownership
- any fonts or external art
- any screenshots that may contain private or third-party content
