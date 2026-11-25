# Build and install

## Supported target

Windows 10/11 x64, MSVC toolchain and WebView2 Runtime. The NSIS/MSI installers embed Microsoft's WebView2 offline installer so installation does not need a network connection. The app embeds its HTML, JavaScript and JSZip assets; conversion does not need internet access.

## Windows prerequisites

- Node.js 22 or newer and npm
- Rust stable with `x86_64-pc-windows-msvc`
- Microsoft C++ Build Tools (MSVC) and Windows SDK
- NSIS and WiX Toolset for the configured NSIS and MSI bundles (the Windows GitHub-hosted runner provides these build tools)

## Develop

From the repository root:

```powershell
npm ci
npm run tauri:dev
```

To run the browser fallback, use `npm run dev` and open `http://127.0.0.1:1420`.

## Build Windows x64 packages

On Windows:

```powershell
npm ci
npm run tauri:build -- --target x86_64-pc-windows-msvc --bundles nsis
```

The expected output is the NSIS `.exe` installer under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`. It carries the WebView2 offline installer. The portable executable ZIP is much smaller and requires WebView2 Runtime already installed on the target machine.

The CI workflow is `.github/workflows/windows-build.yml`. Push a `v*` tag or run it manually from GitHub Actions. It uploads the NSIS installer and portable executable ZIP as `dicom-converter-desktop-windows-x64`. A Windows binary is not checked into this source tree.

The Windows workflow also generates a synthetic ISO and checks that Windows mounts it as a CD-ROM, assigns a drive letter, and exposes both root `DICOMDIR` and a DICOM instance. The app uses Windows PowerShell `Mount-DiskImage` / `Dismount-DiskImage`; the user starts each mount or eject action.

## Install

Run the NSIS installer and follow its prompts; it can install WebView2 offline. To use the portable version, extract the ZIP and run `DICOM-Converter-Desktop-1.2.1-portable.exe` on a machine that already has WebView2 Runtime.

## Offline verification

After installation, disconnect the network and launch the app. Open a synthetic JPG/PNG or DICOM file, convert it, and save the result. The app has no network API dependency; all scripts and styles are local. The online URL in the original README was removed. Google Fonts were replaced with Windows/system font fallbacks.

Choose **DICOM CD / 虛擬光碟 (ISO)** in image export options to generate an ISO. Save it, then use **掛載虛擬光碟**. The displayed drive should contain `DICOMDIR` at its root and a `DICOM` folder. Use **退出虛擬光碟** before removing or replacing the image. No file is sent to INFINITT; import the mounted drive from the workstation yourself.
