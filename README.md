# DICOM Converter Desktop v1.2.1

Windows 10/11 x64 desktop application built with Tauri 2, Rust, WebView2 and Vanilla JavaScript. Image and DICOM conversion runs locally; the app does not upload files or call analytics, telemetry, cloud AI, or external APIs.

## Features

- JPG/PNG to Secondary Capture DICOM (Explicit VR Little Endian), DICOMDIR ZIP, or individual DICOM files in a ZIP.
- DICOM to PNG/JPG, including multi-frame handling, window/level, uncompressed, RLE, JPEG Baseline, and Deflate where supported by the existing engine.
- UTF-8 and Big5 metadata, recursive folder and ZIP import, and preservation of relative paths on export.
- Native Windows file/folder open and save dialogs in Tauri; browser file controls and downloads remain as fallback when opened outside the desktop app.
- JSZip 3.10.1 is vendored in `vendor/`; no Google Fonts, CDN scripts, remote images, or conversion API is loaded.

JPEG 2000, JPEG-LS and JPEG Lossless decoding remain subject to the limitations documented in the original browser implementation. Output is secondary capture, not a diagnostic source.

## Run in a browser

Run `npm ci`, then `npm run dev` and open `http://127.0.0.1:1420`. The browser version keeps its standard file picker, drag/drop and download behavior.

## Desktop build

See [BUILD.md](BUILD.md) for Windows prerequisites, development commands, packaging, installation and offline verification. The GitHub Actions workflow builds a Windows x64 NSIS installer and a portable executable archive.

## Project layout

- `index.html`: original Vanilla JS UI and DICOM engine with a narrow native file-operation adapter.
- `vendor/jszip.min.js`: bundled JSZip 3.10.1.
- `src-tauri/`: Tauri 2 shell and least-privilege plugin capability.
- `.github/workflows/windows-build.yml`: Windows x64 packaging workflow.
- `work/original/`: untouched source files extracted from the supplied v1.2.0 archive.
- `TEST_PLAN.md`: synthetic-data checks and current results.
