# Sonar pre-commit gate for staged files (Windows-safe path resolution).
#
# Runs a secrets-only scan (`sonar hook git-pre-commit`). The golden-path command
# `sonar analyze --staged` also triggers Agentic Analysis, which currently returns
# 403 for the VTEX org (feature not enabled yet), so it is kept commented out below.
# Code quality is still enforced by the full Sonar scan in CI.
$ErrorActionPreference = "Stop"

$sonarInPath = Get-Command sonar -ErrorAction SilentlyContinue
if ($sonarInPath) {
    $sonarExe = $sonarInPath.Source
} else {
    $sonarExe = Join-Path $env:LOCALAPPDATA "sonarqube-cli\bin\sonar.exe"
    if (-not (Test-Path $sonarExe)) {
        Write-Host "Sonar CLI not found. Install with:" -ForegroundColor Red
        Write-Host "  Windows: irm https://raw.githubusercontent.com/SonarSource/sonarqube-cli/refs/heads/master/user-scripts/install.ps1 | iex" -ForegroundColor Red
        Write-Host "  macOS/Linux: curl -o- https://raw.githubusercontent.com/SonarSource/sonarqube-cli/refs/heads/master/user-scripts/install.sh | bash" -ForegroundColor Red
        Write-Host "  Docs: https://darkkitchen.vtex.com/docs/default/domain/engineering/engineering-golden-path/qa-static-analysis/" -ForegroundColor Red
        exit 1
    }
}

# Golden path (re-enable when Agentic Analysis is available for the org):
# & $sonarExe analyze --staged --project vtex_goldenpath
& $sonarExe hook git-pre-commit
exit $LASTEXITCODE
