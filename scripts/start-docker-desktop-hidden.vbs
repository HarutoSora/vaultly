' Starts Docker Desktop at log on (containers with `restart: unless-stopped`
' then come back on their own once the Docker daemon is up). Placed in the
' Startup folder by install-startup.ps1.
CreateObject("Wscript.Shell").Run "docker desktop start", 0, False
