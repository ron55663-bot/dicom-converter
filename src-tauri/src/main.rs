#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, path::Path, process::Command};
use serde::Serialize;

#[derive(Serialize)]
struct MountResult { drive: String, already_mounted: bool }

fn validate_iso(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    if !p.is_absolute() || p.extension().and_then(|x| x.to_str()).map(|x| !x.eq_ignore_ascii_case("iso")).unwrap_or(true) {
        return Err("請選擇已儲存的 ISO 檔案".into());
    }
    let bytes = fs::read(p).map_err(|e| format!("無法讀取 ISO：{e}"))?;
    if bytes.len() < 17 * 2048 || &bytes[16 * 2048 + 1..16 * 2048 + 6] != b"CD001" {
        return Err("檔案不是有效的 ISO 9660 映像".into());
    }
    // Root directory record in the PVD points to an ISO directory extent.
    let pvd = &bytes[16 * 2048..17 * 2048];
    let extent = u32::from_le_bytes(pvd[158..162].try_into().unwrap()) as usize;
    let root_size = u32::from_le_bytes(pvd[166..170].try_into().unwrap()) as usize;
    let root_end = extent.checked_mul(2048).and_then(|n| n.checked_add(root_size)).ok_or("ISO 目錄索引超出範圍")?;
    if root_end > bytes.len() { return Err("ISO 根目錄索引損毀".into()); }
    let root = &bytes[extent * 2048..root_end];
    let has_dir = root.windows(11).any(|w| w == b"DICOMDIR.;1");
    if !has_dir { return Err("ISO 根目錄找不到 DICOMDIR".into()); }
    Ok(p.to_string_lossy().into_owned())
}

fn powershell(script: &str, path: &str) -> Result<String, String> {
    let output = Command::new("powershell.exe").args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
        .env("DICOM_ISO_PATH", path).output().map_err(|e| format!("無法啟動 Windows ISO 工具：{e}"))?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn mount_iso(path: String) -> Result<MountResult, String> {
    validate_iso(&path)?;
    let script = r#"$ErrorActionPreference='Stop'; $p=$env:DICOM_ISO_PATH; $img=Get-DiskImage -ImagePath $p -ErrorAction SilentlyContinue; $already=($null -ne $img -and $img.Attached); if(-not $already){ Mount-DiskImage -ImagePath $p -PassThru | Out-Null }; $vol=Get-DiskImage -ImagePath $p | Get-Volume | Where-Object DriveLetter | Select-Object -First 1; if(-not $vol){ throw 'Windows 未配置掛載磁碟代號' }; $letter=[string]$vol.DriveLetter; $root=$letter+':\'; if(-not (Test-Path -LiteralPath ($root+'DICOMDIR') -PathType Leaf)){ if(-not $already){ Dismount-DiskImage -ImagePath $p | Out-Null }; throw '掛載磁碟根目錄找不到 DICOMDIR' }; $disk=Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='"+$letter+":'"); if($disk.DriveType -ne 5){ throw 'Windows 未將此映像識別為 CD-ROM' }; Write-Output ($letter+'|'+$already)"#;
    let out = powershell(script, &path)?;
    let mut fields = out.split('|');
    let drive = fields.next().unwrap_or("").to_string();
    if drive.len() != 1 { return Err("Windows 未回傳有效磁碟代號".into()); }
    let already_mounted = fields.next().unwrap_or("False").eq_ignore_ascii_case("True");
    Ok(MountResult { drive, already_mounted })
}

#[tauri::command]
fn eject_iso(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.is_absolute() || p.extension().and_then(|x| x.to_str()).map(|x| !x.eq_ignore_ascii_case("iso")).unwrap_or(true) {
        return Err("ISO 路徑無效".into());
    }
    let script = r#"$ErrorActionPreference='Stop'; $p=$env:DICOM_ISO_PATH; $img=Get-DiskImage -ImagePath $p -ErrorAction SilentlyContinue; if($img -and $img.Attached){ Dismount-DiskImage -ImagePath $p | Out-Null; Write-Output 'ejected' } else { Write-Output 'already-ejected' }"#;
    powershell(script, &path)
}

#[tauri::command]
fn open_mounted_folder(drive_letter: String) -> Result<(), String> {
    let letter = drive_letter.trim_end_matches(':');
    if letter.len() != 1 || !letter.as_bytes()[0].is_ascii_alphabetic() { return Err("無效的磁碟代號".into()); }
    Command::new("explorer.exe").arg(format!("{}:\\", letter)).spawn().map(|_| ()).map_err(|e| format!("無法開啟檔案總管：{e}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![mount_iso, eject_iso, open_mounted_folder])
        .run(tauri::generate_context!())
        .expect("error while running DICOM Converter Desktop");
}
