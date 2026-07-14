$piIP = "10.250.2.247"
$piUser = "hvac"
$piDestDir = "~/terratrack-s3/gateway"

Write-Host "Deploying gateway code to Raspberry Pi at $piIP..."

# Using scp to copy the files over. Ensure ssh keys are set up or be prepared to enter a password.
scp -r .\gateway\src\* ${piUser}@${piIP}:${piDestDir}/

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful. Restarting Pi service..." -ForegroundColor Green
    ssh ${piUser}@${piIP} "sudo systemctl restart hvac-crawler"
    Write-Host "Service restarted." -ForegroundColor Green
} else {
    Write-Host "Deployment failed. Please check network connection and SSH credentials." -ForegroundColor Red
}
