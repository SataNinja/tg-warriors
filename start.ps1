$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Step($msg) { Write-Host "" ; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    WARN: $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "" ; Write-Host "ERROR: $msg" -ForegroundColor Red ; Read-Host "Press Enter to exit" ; exit 1 }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Magenta
Write-Host "   TG Warriors - Project Launcher" -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Magenta

# --- 1. Check Docker ---
Write-Step "Checking Docker..."
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Ok "Docker is running"
} catch {
    Write-Fail "Docker is not running. Please open Docker Desktop and try again."
}

# --- 2. Find or download ngrok ---
Write-Step "Checking ngrok..."
$ngrokPath = $null

try { $ngrokPath = (Get-Command ngrok -ErrorAction SilentlyContinue).Source } catch {}
if (-not $ngrokPath -and (Test-Path "$ScriptDir\ngrok.exe")) { $ngrokPath = "$ScriptDir\ngrok.exe" }

if (-not $ngrokPath) {
    Write-Warn "ngrok not found. Downloading..."
    $ngrokZip = "$ScriptDir\ngrok.zip"
    $ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ngrokUrl -OutFile $ngrokZip -UseBasicParsing
        Expand-Archive -Path $ngrokZip -DestinationPath $ScriptDir -Force
        Remove-Item $ngrokZip -Force
        $ngrokPath = "$ScriptDir\ngrok.exe"
        Write-Ok "ngrok downloaded"
    } catch {
        Write-Fail "Failed to download ngrok. Download manually from https://ngrok.com/download and place ngrok.exe next to start.ps1"
    }
} else {
    Write-Ok "ngrok found: $ngrokPath"
}

# --- 3. Read existing .env or ask for tokens ---
Write-Step "Setting up tokens..."

$envFile = "$ScriptDir\.env"
$existingBotToken   = ""
$existingNgrokToken = ""

if (Test-Path $envFile) {
    $lines = Get-Content $envFile -Encoding UTF8
    foreach ($line in $lines) {
        if ($line -match "^BOT_TOKEN=(.+)$")       { $existingBotToken   = $Matches[1].Trim() }
        if ($line -match "^NGROK_AUTHTOKEN=(.+)$") { $existingNgrokToken = $Matches[1].Trim() }
    }
}

# BOT_TOKEN
if ($existingBotToken -and $existingBotToken.Length -gt 30 -and $existingBotToken -notlike "*your_bot*") {
    Write-Ok "BOT_TOKEN already in .env"
    $BOT_TOKEN = $existingBotToken
} else {
    Write-Host ""
    Write-Host "  Enter your BOT_TOKEN from @BotFather" -ForegroundColor Yellow
    Write-Host "  Example: 1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxx" -ForegroundColor Gray
    $BOT_TOKEN = (Read-Host "  BOT_TOKEN").Trim()
    if (-not $BOT_TOKEN -or $BOT_TOKEN.Length -lt 30) { Write-Fail "Invalid BOT_TOKEN" }
}

# NGROK_AUTHTOKEN
if ($existingNgrokToken -and $existingNgrokToken.Length -gt 20) {
    Write-Ok "NGROK_AUTHTOKEN already in .env"
    $NGROK_TOKEN = $existingNgrokToken
} else {
    Write-Host ""
    Write-Host "  Enter your ngrok Auth Token" -ForegroundColor Yellow
    Write-Host "  Get it at: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Gray
    $NGROK_TOKEN = (Read-Host "  NGROK_AUTHTOKEN").Trim()
    if (-not $NGROK_TOKEN -or $NGROK_TOKEN.Length -lt 10) { Write-Fail "Invalid NGROK_AUTHTOKEN" }
}

# --- 4. Configure ngrok auth ---
Write-Step "Configuring ngrok auth..."
& $ngrokPath config add-authtoken $NGROK_TOKEN 2>&1 | Out-Null
Write-Ok "ngrok authenticated"

# --- 5. Stop old ngrok if running ---
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# --- 6. Start ngrok tunnel ---
Write-Step "Starting ngrok tunnel on port 3000..."
$ngrokProcess = Start-Process -FilePath $ngrokPath `
    -ArgumentList "http", "3000" `
    -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 4

# --- 7. Get public URL from ngrok API ---
Write-Step "Getting public HTTPS URL..."
$MINI_APP_URL = $null
$attempts = 0

while (-not $MINI_APP_URL -and $attempts -lt 15) {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
        foreach ($t in $tunnels.tunnels) {
            if ($t.proto -eq "https") { $MINI_APP_URL = $t.public_url ; break }
        }
    } catch {}
}

if (-not $MINI_APP_URL) {
    Write-Fail "Could not get URL from ngrok. Check http://localhost:4040 in your browser."
}

Write-Ok "Tunnel URL: $MINI_APP_URL"

# --- 8. Write .env file ---
Write-Step "Writing .env file..."

$DB_PASS   = "TgWarriorsPass2024"
$RandBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($RandBytes)
$SECRET_KEY = ([System.BitConverter]::ToString($RandBytes)).Replace("-","").ToLower()

$envContent = "# Telegram`r`nBOT_TOKEN=$BOT_TOKEN`r`nMINI_APP_URL=$MINI_APP_URL`r`nNGROK_AUTHTOKEN=$NGROK_TOKEN`r`n`r`n# PostgreSQL`r`nPOSTGRES_DB=tgame`r`nPOSTGRES_USER=tgame_user`r`nPOSTGRES_PASSWORD=$DB_PASS`r`nDATABASE_URL=postgresql+asyncpg://tgame_user:${DB_PASS}@postgres:5432/tgame`r`n`r`n# Redis`r`nREDIS_URL=redis://redis:6379/0`r`n`r`n# Backend`r`nBACKEND_URL=http://backend:8000`r`nSECRET_KEY=$SECRET_KEY`r`n"

[System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::ASCII)
Write-Ok ".env created"

# --- 9. Run docker-compose ---
Write-Step "Starting Docker containers (first build may take 3-5 min)..."
Write-Host ""

# We already Set-Location to $ScriptDir at the top — use relative path to avoid Cyrillic path issues
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Warn "docker compose v2 failed, trying docker-compose v1..."
    docker-compose up --build -d
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker-compose failed. Check that Docker Desktop is running." }
}

# --- 10. Wait for backend health ---
Write-Step "Waiting for backend to start..."
$backendReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 3
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) { $backendReady = $true ; break }
    } catch {}
    Write-Host "    Waiting... ($([int]($i * 3))s)" -ForegroundColor Gray
}

if ($backendReady) {
    Write-Ok "Backend is ready!"
} else {
    Write-Warn "Backend is taking long. Check logs: docker compose logs backend"
}

# --- Done ---
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "   PROJECT IS RUNNING!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  ngrok    : $MINI_APP_URL" -ForegroundColor White
Write-Host "  ngrok UI : http://localhost:4040" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEP - Register Mini App in @BotFather:" -ForegroundColor Cyan
Write-Host "  1. Open @BotFather in Telegram" -ForegroundColor White
Write-Host "  2. Send: /mybots" -ForegroundColor White
Write-Host "  3. Select your bot" -ForegroundColor White
Write-Host "  4. Bot Settings -> Menu Button -> Edit menu button URL" -ForegroundColor White
Write-Host "  5. Paste this URL: $MINI_APP_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Stop:  docker compose down" -ForegroundColor Gray
Write-Host "  Logs:  docker compose logs -f" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close this window"
