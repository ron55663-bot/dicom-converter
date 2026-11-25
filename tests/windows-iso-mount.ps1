param([Parameter(Mandatory=$true)][string]$IsoPath)
$ErrorActionPreference = 'Stop'
$before = @(Get-DiskImage -ImagePath (Resolve-Path $IsoPath).Path -ErrorAction SilentlyContinue | Where-Object Attached)
try {
  Mount-DiskImage -ImagePath (Resolve-Path $IsoPath).Path -PassThru | Out-Null
  $volume = Get-DiskImage -ImagePath (Resolve-Path $IsoPath).Path | Get-Volume | Where-Object DriveLetter | Select-Object -First 1
  if (-not $volume) { throw 'No drive letter was assigned to the ISO.' }
  $root = "$($volume.DriveLetter):\"
  if (-not (Test-Path -LiteralPath (Join-Path $root 'DICOMDIR') -PathType Leaf)) { throw 'DICOMDIR is missing from the mounted volume root.' }
  if (-not (Test-Path -LiteralPath (Join-Path $root 'DICOM\IM000001') -PathType Leaf)) { throw 'Referenced DICOM instance is missing.' }
  $drive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($volume.DriveLetter):'"
  if ($drive.DriveType -ne 5) { throw "Expected CD-ROM drive type 5, got $($drive.DriveType)." }
  Write-Host "Mounted as CD-ROM $($volume.DriveLetter):; DICOMDIR and instance found."
} finally {
  if (-not $before) { Dismount-DiskImage -ImagePath (Resolve-Path $IsoPath).Path -ErrorAction SilentlyContinue | Out-Null }
}
