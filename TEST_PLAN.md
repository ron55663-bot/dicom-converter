# Synthetic-data test plan

No real patient data is required or included. Run tests on synthetic or de-identified DICOM only. “Passed” below means it was executed in the local browser fallback; desktop-only and codec-specific tests remain pending Windows validation.

| Case | Expected check | Current result |
| --- | --- | --- |
| JPG → DICOM | Encode pixels and metadata; reparse output | Pending |
| PNG → DICOM | Rows/Columns, Explicit VR LE, Pixel Data and UID | Passed: synthetic 3×2 RGB PNG, 918-byte DICOM |
| Multiple images → DICOM ZIP | One DICOM per image, no duplicate save | Pending |
| Multiple images → DICOMDIR ZIP | DICOMDIR plus image records and files | Passed: ZIP structure and output parsed |
| DICOM → PNG | PNG signature and valid image | Passed: ZIP output inspected |
| DICOM → JPG | JPEG signature and valid image | Passed: ZIP output inspected |
| Multi-frame DICOM | All frames and first-frame modes | Pending |
| RLE DICOM | Decode synthetic RLE pixels | Pending |
| JPEG Baseline DICOM | Decode synthetic JPEG frame in WebView2 | Pending |
| Deflate DICOM | Inflate and parse dataset | Pending |
| UTF-8 Chinese metadata | Correct Specific Character Set and decoded text | Pending |
| Big5 metadata | Big5 text decode and known delimiter caveat | Pending |
| ZIP import | Recursive classification and DICOM reparse | Passed: generated DICOMDIR ZIP reimported |
| Folder batch import | Recursive nested files and relative paths | Pending (Tauri native picker) |
| Native file save | Save-dialog path and byte-for-byte output | Pending (requires Windows Tauri build) |
| ISO 9660 Level 1 | PVD, 2048-byte blocks, root DICOMDIR, uppercase file IDs, and exact payload bytes | Passed: Node assertions and independent pycdlib open/extract |
| ISO mount | Mounted as CD-ROM, drive letter, root DICOMDIR and referenced image | Pending Windows CI run |
| DICOMDIR reference paths in ISO | Generated IMAGE records use the same `DICOM/IMxxxxxx` IDs as ISO files | Passed by construction in export path; hospital viewer validation pending |
| INFINITT import | Import from mounted virtual CD on actual workstation | Not tested; requires hospital installation |

## Executed evidence

- `node --check` on the inline JavaScript extracted from `index.html` and both Node scripts.
- `npm ci` and `npm run build` completed successfully.
- Browser fallback converted a synthetic 3×2 RGB PNG to a DICOMDIR ZIP, then reimported the ZIP and decoded the DICOM.
- DICOM binary inspection confirmed Transfer Syntax UID `1.2.840.10008.1.2.1`, Rows `2`, Columns `3`, Samples per Pixel `3`, Pixel Data length `18` bytes and numeric-dot SOP Instance UID.
- PNG and JPG outputs were exported and their PNG/JPEG signatures checked.
- A synthetic ISO was independently opened and files extracted with `pycdlib`, and mounted read-only with macOS DiskImages; `DICOMDIR` and both instance files were visible at the expected paths. Windows CD-ROM classification is covered by the Windows CI PowerShell step and remains pending its run.
- Offline source scan found no Google Fonts, CDN, `window.claude` integration, remote images, or external runtime script in the app. The only `https://` strings in project config are schema/CI metadata and are not loaded by the application.

A native Windows build and the pending codec/metadata test cases are required before claiming complete Windows release validation.
