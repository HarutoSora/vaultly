# Makes the whole Docker-based Vaultly stack come back automatically after
# a reboot: this places one small VBScript launcher into your per-user
# Startup folder that starts Docker Desktop at log on. Docker Desktop then
# brings up every container in docker-compose.yml on its own, because they
# all have `restart: unless-stopped`.
#
# No admin rights needed — this is a plain file copy into a folder Windows
# already scans automatically at every log on, not a system service.
#
# Prerequisite (one-time, manual): Docker Desktop must be able to start
# without you clicking through anything — sign in once if it prompts you
# to, and dismiss any first-run dialogs, before relying on this.
#
# Run once to install: powershell -ExecutionPolicy Bypass -File scripts\install-startup.ps1
# To remove: powershell -ExecutionPolicy Bypass -File scripts\uninstall-startup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$startupDir = [Environment]::GetFolderPath("Startup")

Copy-Item "$root\scripts\start-docker-desktop-hidden.vbs" "$startupDir\VaultlyDockerDesktop.vbs" -Force

Write-Host "Installed into: $startupDir"
Write-Host "Docker Desktop will now launch automatically at every future log on,"
Write-Host "and docker-compose.yml's 'restart: unless-stopped' containers will come up with it."
