<#
.SYNOPSIS
  Voir — Open Markdown files from the terminal.

.DESCRIPTION
  Launches Voir with the specified Markdown file(s) or directory.
  If Voir is already running, sends files to the existing instance.

.PARAMETER Path
  One or more Markdown file paths or a directory to open.

.EXAMPLE
  voir README.md
  voir docs/
  voir file1.md file2.md
#>

param(
    [Parameter(Position = 0, ValueFromRemainingArguments)]
    [string[]]$Path
)

$ErrorActionPreference = "Stop"

# Find Voir executable
$voirExe = $null
$candidates = @(
    "$env:LOCALAPPDATA\Voir\Voir.exe",
    "$env:ProgramFiles\Voir\Voir.exe",
    "${env:ProgramFiles(x86)}\Voir\Voir.exe",
    (Get-Command "Voir.exe" -ErrorAction SilentlyContinue)?.Source
)

foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
        $voirExe = $c
        break
    }
}

if (-not $voirExe) {
    Write-Error "Voir executable not found. Please install Voir or add it to PATH."
    exit 1
}

# Resolve paths to absolute
$resolvedPaths = @()
foreach ($p in $Path) {
    if ($p) {
        $resolved = Resolve-Path $p -ErrorAction SilentlyContinue
        if ($resolved) {
            $resolvedPaths += $resolved.Path
        } else {
            Write-Warning "Path not found: $p"
        }
    }
}

# Launch Voir
if ($resolvedPaths.Count -eq 0) {
    & $voirExe
} else {
    & $voirExe @resolvedPaths
}
