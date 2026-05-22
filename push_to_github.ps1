$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Step($msg) { Write-Host "" ; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "" ; Write-Host "ERROR: $msg" -ForegroundColor Red ; pause ; exit 1 }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Magenta
Write-Host "   TG Warriors - Push to GitHub" -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Magenta

# --- 1. Check git ---
Write-Step "Checking git..."
try {
    $v = git --version 2>&1
    Write-Ok "git found: $v"
} catch {
    Write-Fail "git not found. Install from: https://git-scm.com/download/win and re-run this script."
}

# --- 2. Ask for GitHub repo URL ---
Write-Host ""
Write-Host "  BEFORE YOU CONTINUE:" -ForegroundColor Yellow
Write-Host "  1. Go to https://github.com/new" -ForegroundColor White
Write-Host "  2. Create a NEW EMPTY repo (no README, no .gitignore)" -ForegroundColor White
Write-Host "  3. Copy the repo URL (e.g. https://github.com/you/tg-warriors)" -ForegroundColor White
Write-Host ""
$REPO_URL = (Read-Host "  Paste GitHub repo URL here").Trim()
if (-not $REPO_URL -or -not $REPO_URL.StartsWith("https://github.com")) {
    Write-Fail "Invalid URL. Must be: https://github.com/username/reponame"
}

# --- 3. Init git ---
Write-Step "Initializing git..."
if (-not (Test-Path "$ScriptDir\.git")) {
    git init
    Write-Ok "git init done"
} else {
    Write-Ok "git already initialized"
}

# --- 4. Set git user if missing ---
$gitEmail = git config user.email 2>&1
if (-not $gitEmail -or "$gitEmail" -eq "") {
    Write-Host ""
    Write-Host "  Enter your GitHub email:" -ForegroundColor Yellow
    $GIT_EMAIL = (Read-Host "  Email").Trim()
    Write-Host "  Enter your name:" -ForegroundColor Yellow
    $GIT_NAME = (Read-Host "  Name").Trim()
    git config user.email $GIT_EMAIL
    git config user.name $GIT_NAME
    Write-Ok "git user set"
}

# --- 5. Set remote ---
Write-Step "Setting remote origin..."
$remotes = git remote 2>&1
if ("$remotes" -match "origin") {
    git remote set-url origin $REPO_URL
    Write-Ok "Remote updated"
} else {
    git remote add origin $REPO_URL
    Write-Ok "Remote added"
}

# --- 6. Commit ---
Write-Step "Staging and committing files..."
git add .
$changed = git status --short 2>&1
if ("$changed" -eq "") {
    Write-Ok "Nothing new to commit"
} else {
    git commit -m "Initial commit: TG Warriors"
    Write-Ok "Committed"
}

# --- 7. Push ---
Write-Step "Pushing to GitHub..."
Write-Host "  If prompted for password: use a Personal Access Token" -ForegroundColor Gray
Write-Host "  Create one at: https://github.com/settings/tokens/new" -ForegroundColor Gray
Write-Host "  (check the 'repo' checkbox, then copy the token as password)" -ForegroundColor Gray
Write-Host ""

git branch -M main
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Push failed. Check the repo URL and your GitHub credentials."
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "   SUCCESS! Code is on GitHub!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Repo: $REPO_URL" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEP: Deploy to Railway" -ForegroundColor Cyan
Write-Host "  1. Go to https://railway.app" -ForegroundColor White
Write-Host "  2. Login with GitHub" -ForegroundColor White
Write-Host "  3. New Project -> Deploy from GitHub repo" -ForegroundColor White
Write-Host "  4. Select this repository" -ForegroundColor White
Write-Host ""
pause
