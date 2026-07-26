#!/usr/bin/env pwsh
# Install the vs plugin into Claude Code, Codex, and/or Cursor on Windows.
#
# Local:  ./install.ps1
# Remote: irm https://raw.githubusercontent.com/vltansky/vs/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$Repo = 'vltansky/vs'
$Plugin = 'vs@vs'

function Write-Ok {
  param([string]$Message)
  Write-Host '  ' -NoNewline
  Write-Host ([char]0x2713) -ForegroundColor Green -NoNewline
  Write-Host " $Message"
}

function Write-Skip {
  param([string]$Message)
  Write-Host '  ' -NoNewline
  Write-Host '-' -ForegroundColor Yellow -NoNewline
  Write-Host " $Message"
}

function Write-Fail {
  param([string]$Message)
  Write-Host '  ' -NoNewline
  Write-Host ([char]0x2717) -ForegroundColor Red -NoNewline
  Write-Host " $Message"
}

function Invoke-Cli {
  param([string]$Cli, [string[]]$CliArgs, [System.Collections.Generic.List[string]]$Log)
  # Native stderr and non-zero exits must not throw here; we report them ourselves.
  $ErrorActionPreference = 'Continue'
  & $Cli @CliArgs 2>&1 | ForEach-Object { $Log.Add([string]$_) }
  return $LASTEXITCODE -eq 0
}

function Install-For {
  param([string]$Cli, [string[][]]$Commands)
  if (-not (Get-Command $Cli -ErrorAction SilentlyContinue)) {
    Write-Skip "$Cli not found - skipping"
    return
  }
  $log = [System.Collections.Generic.List[string]]::new()
  foreach ($command in $Commands) {
    if (Invoke-Cli -Cli $Cli -CliArgs $command -Log $log) { continue }
    Write-Fail "${Cli}: install failed"
    $log | ForEach-Object { Write-Host "      $_" }
    return
  }
  Write-Ok "${Cli}: installed $Plugin"
}

function Remove-Path {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  # Remove-Item -Recurse follows junctions on Windows PowerShell and would delete
  # the link target's contents, so unlink reparse points directly.
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    $item.Delete()
    return
  }
  Remove-Item -LiteralPath $Path -Recurse -Force
}

# Cursor has no plugin CLI; the documented path is a local plugin under
# ~/.cursor/plugins/local/. Junction a clone if we're running from one, else
# clone the repo there. Junctions work without Developer Mode or elevation.
function Install-Cursor {
  $cursorHome = Join-Path $HOME '.cursor'
  if (-not (Test-Path -LiteralPath $cursorHome) -and -not (Get-Command cursor -ErrorAction SilentlyContinue)) {
    Write-Skip 'cursor not found - skipping'
    return
  }
  $localPlugins = Join-Path $cursorHome 'plugins/local'
  New-Item -ItemType Directory -Force -Path $localPlugins | Out-Null
  $dest = Join-Path $localPlugins 'vs'

  $src = $PSScriptRoot
  if ($src -and (Test-Path -LiteralPath (Join-Path $src '.cursor-plugin/plugin.json'))) {
    Remove-Path $dest
    # $IsWindows is undefined on Windows PowerShell 5.1, so read the OS env var.
    $linkType = if ($env:OS -eq 'Windows_NT') { 'Junction' } else { 'SymbolicLink' }
    New-Item -ItemType $linkType -Path $dest -Target $src | Out-Null
    Write-Ok "cursor: linked $dest -> $src"
    return
  }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Fail 'cursor: git not found'
    return
  }
  $tmp = "$dest.tmp"
  Remove-Path $tmp
  $ErrorActionPreference = 'Continue'
  & git clone --depth 1 "https://github.com/$Repo" $tmp 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Remove-Path $dest
    Move-Item -LiteralPath $tmp -Destination $dest
    Write-Ok "cursor: cloned to $dest"
    return
  }
  Remove-Path $tmp
  Write-Fail 'cursor: clone failed'
}

Write-Host 'Installing vs plugin...'
Install-For -Cli 'claude' -Commands @(
  @('plugin', 'marketplace', 'add', $Repo),
  @('plugin', 'marketplace', 'update', 'vs'),
  @('plugin', 'install', $Plugin),
  @('plugin', 'update', $Plugin)
)
Install-For -Cli 'codex' -Commands @(
  @('plugin', 'marketplace', 'add', $Repo),
  @('plugin', 'marketplace', 'upgrade', 'vs'),
  @('plugin', 'add', $Plugin)
)
Install-Cursor
Write-Host 'Done. Restart your agent session (Cursor: Developer: Reload Window) to load vs.'
