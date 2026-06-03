$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sourceLogoPath = Join-Path $projectRoot 'LOGO.png'
$buildDir = Join-Path $projectRoot 'build'

if (-not (Test-Path $sourceLogoPath)) {
  throw "Logo source not found: $sourceLogoPath"
}

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

function New-LogoBitmap {
  param(
    [System.Drawing.Image] $Source,
    [int] $Size
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $sourceRatio = $Source.Width / $Source.Height
  $targetRatio = 1

  if ($sourceRatio -gt $targetRatio) {
    $drawWidth = $Size
    $drawHeight = $Size / $sourceRatio
  } else {
    $drawHeight = $Size
    $drawWidth = $Size * $sourceRatio
  }

  $drawX = ($Size - $drawWidth) / 2
  $drawY = ($Size - $drawHeight) / 2
  $targetRect = New-Object System.Drawing.RectangleF($drawX, $drawY, $drawWidth, $drawHeight)
  $graphics.DrawImage($Source, $targetRect)
  $graphics.Dispose()

  return $bitmap
}

function Convert-BitmapToPngBytes {
  param([System.Drawing.Bitmap] $Bitmap)

  $stream = New-Object System.IO.MemoryStream
  $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  $stream.Dispose()

  return ,$bytes
}

function Convert-BitmapToIconDibBytes {
  param([System.Drawing.Bitmap] $Bitmap)

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $xorSize = $width * $height * 4
  $maskStride = [Math]::Floor(($width + 31) / 32) * 4
  $andSize = $maskStride * $height

  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($stream)

  $writer.Write([UInt32]40)
  $writer.Write([Int32]$width)
  $writer.Write([Int32]($height * 2))
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]0)
  $writer.Write([UInt32]($xorSize + $andSize))
  $writer.Write([Int32]0)
  $writer.Write([Int32]0)
  $writer.Write([UInt32]0)
  $writer.Write([UInt32]0)

  for ($y = $height - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $width; $x++) {
      $color = $Bitmap.GetPixel($x, $y)
      $writer.Write([Byte]$color.B)
      $writer.Write([Byte]$color.G)
      $writer.Write([Byte]$color.R)
      $writer.Write([Byte]$color.A)
    }
  }

  $writer.Write((New-Object Byte[] $andSize))
  $writer.Flush()
  $bytes = $stream.ToArray()
  $writer.Dispose()
  $stream.Dispose()

  return ,$bytes
}

$sourceLogo = [System.Drawing.Image]::FromFile($sourceLogoPath)

$pngPath = Join-Path $buildDir 'icon.png'
$previewBitmap = New-LogoBitmap -Source $sourceLogo -Size 1024
[System.IO.File]::WriteAllBytes($pngPath, (Convert-BitmapToPngBytes -Bitmap $previewBitmap))
$previewBitmap.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = foreach ($size in $sizes) {
  $bitmap = New-LogoBitmap -Source $sourceLogo -Size $size
  $bytes = Convert-BitmapToIconDibBytes -Bitmap $bitmap
  $bitmap.Dispose()

  [pscustomobject]@{
    Size = $size
    Bytes = [byte[]]$bytes
  }
}

$sourceLogo.Dispose()

$icoPath = Join-Path $buildDir 'icon.ico'
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$images.Count)

$offset = 6 + (16 * $images.Count)
foreach ($image in $images) {
  $widthByte = if ($image.Size -eq 256) { 0 } else { $image.Size }
  $writer.Write([Byte]$widthByte)
  $writer.Write([Byte]$widthByte)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$image.Bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $image.Bytes.Length
}

foreach ($image in $images) {
  $writer.Write($image.Bytes)
}

$writer.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

Write-Host "Generated $pngPath from $sourceLogoPath"
Write-Host "Generated $icoPath from $sourceLogoPath"
