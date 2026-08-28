# Removes the auto-start entry installed by install-startup.ps1. Does not
# stop Docker Desktop or any running containers — see the README note.
$startupDir = [Environment]::GetFolderPath("Startup")
Remove-Item "$startupDir\VaultlyDockerDesktop.vbs" -ErrorAction SilentlyContinue
Remove-Item "$startupDir\VaultlyBackend.vbs" -ErrorAction SilentlyContinue   # left over from the pre-Docker setup, if present
Remove-Item "$startupDir\VaultlyFrontend.vbs" -ErrorAction SilentlyContinue  # left over from the pre-Docker setup, if present
Write-Host "Removed from: $startupDir"
