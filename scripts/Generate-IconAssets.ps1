param(
  [string]$SourcePng = "D:\WinRecovery\runtime\minimal-web\public\assets\fish-logo.png",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path (Split-Path -Parent $PSScriptRoot) "build\icons"
}

if (-not (Test-Path -LiteralPath $SourcePng)) {
  throw "Source icon file not found: $SourcePng"
}

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$pngOutput = Join-Path $OutputDir "app.png"
$icoOutput = Join-Path $OutputDir "app.ico"

Copy-Item -LiteralPath $SourcePng -Destination $pngOutput -Force

$sizes = @(256, 128, 64, 48, 32, 24, 16)
$sourceImage = [System.Drawing.Image]::FromFile($SourcePng)
$iconImages = New-Object System.Collections.Generic.List[object]

try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    try {
      $bitmap.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
      } finally {
        $graphics.Dispose()
      }

      $stream = New-Object System.IO.MemoryStream
      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $iconImages.Add([PSCustomObject]@{
          Size = $size
          Bytes = $stream.ToArray()
        })
      } finally {
        $stream.Dispose()
      }
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}

$fileStream = [System.IO.File]::Open($icoOutput, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
  $writer = New-Object System.IO.BinaryWriter $fileStream
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$iconImages.Count)

    $offset = 6 + (16 * $iconImages.Count)
    foreach ($entry in $iconImages) {
      $dimension = if ($entry.Size -ge 256) { 0 } else { [byte]$entry.Size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$entry.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $entry.Bytes.Length
    }

    foreach ($entry in $iconImages) {
      $writer.Write($entry.Bytes)
    }
  } finally {
    $writer.Dispose()
  }
} finally {
  $fileStream.Dispose()
}

Write-Output "Generated icon assets:"
Write-Output $pngOutput
Write-Output $icoOutput
