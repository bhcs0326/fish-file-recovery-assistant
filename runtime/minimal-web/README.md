# WinRecovery Minimal Web

This is the smallest runnable implementation for the current project stage.

## What It Does

- load a mock scan result set
- switch between quick scan and deep scan
- filter and search candidates
- inspect candidate details
- export a scan report into `artifacts/reports`
- create a restore manifest into `artifacts/restored`
- record recent actions into `artifacts/logs/minimal-web-activity.json`

## Run

Use:

- `D:\WinRecovery\scripts\Start-MinimalWeb.ps1`

Stop with:

- `D:\WinRecovery\scripts\Stop-MinimalWeb.ps1`

The app opens at:

- `http://127.0.0.1:4318`

## Why This Exists

The current machine has Node available but does not yet have a working .NET build chain in PATH. This lets us test flow and UI now while keeping the WPF direction intact for later.

## Layer Alignment

The runtime is now split into:

- `src/adapters`
- `src/repositories`
- `src/services`
- `src/controllers`
- `src/http`

This keeps backend contracts aligned with the front-end state flow before we plug in a real recovery adapter.
