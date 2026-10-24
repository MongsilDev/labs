# Labs 대회 결과 자동 업로드
# 이 파일에는 업로드 키가 들어 있습니다. 다른 사람에게 보내지 마세요.
# 실행: powershell -ExecutionPolicy Bypass -File .\이 파일 이름.ps1
# 결과 폴더를 바꾸려면 -Folder "경로"를 붙여 실행합니다.
param([string]$Folder)

$UploadUrl = '__LABS_URL__'
$UploadKey = '__LABS_KEY__'
$Title = '__LABS_TITLE__'
$DefaultFolder = 'C:\Program Files (x86)\Steam\steamapps\common\Eternal Return'
$ResultFile = 'GameResult_.csv'
$Required = @('teamName', 'tournament total score', 'tournament kill score', 'gameId')
$RetryDelays = @(5, 15, 30, 60, 120)

# 따옴표로 감싼 칸 안의 쉼표는 나누지 않음
function Split-CsvLine([string]$Line) {
  $out = New-Object System.Collections.Generic.List[string]
  $sb = New-Object System.Text.StringBuilder
  $quoted = $false
  for ($i = 0; $i -lt $Line.Length; $i++) {
    $c = $Line[$i]
    if ($quoted) {
      if ($c -eq '"') {
        if ($i + 1 -lt $Line.Length -and $Line[$i + 1] -eq '"') { [void]$sb.Append('"'); $i++ } else { $quoted = $false }
      } else { [void]$sb.Append($c) }
    } elseif ($c -eq '"') { $quoted = $true }
    elseif ($c -eq ',') { $out.Add($sb.ToString()); [void]$sb.Clear() }
    else { [void]$sb.Append($c) }
  }
  $out.Add($sb.ToString())
  return , $out.ToArray()
}

# 서버와 같은 필수 열을 보고 둘째 줄의 gameId를 읽음
function Read-ResultCsv([string]$Text) {
  if ($Text.Length -gt 0 -and $Text[0] -eq [char]0xFEFF) { $Text = $Text.Substring(1) }
  $lines = @($Text -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
  if ($lines.Count -lt 2) { return [pscustomobject]@{ Ok = $false; GameId = $null; Error = '경기 기록이 없는 파일입니다.' } }
  $header = @(Split-CsvLine $lines[0] | ForEach-Object { $_.Trim() })
  $missing = @($Required | Where-Object { $header -notcontains $_ })
  if ($missing.Count -gt 0) { return [pscustomobject]@{ Ok = $false; GameId = $null; Error = "결과 CSV가 아닙니다. 없는 열: $($missing -join ', ')" } }
  $row = Split-CsvLine $lines[1]
  $at = [array]::IndexOf($header, 'gameId')
  $id = ''
  if ($at -lt $row.Length) { $id = $row[$at].Trim() }
  if ($id -notmatch '^\d+$') { return [pscustomobject]@{ Ok = $false; GameId = $null; Error = 'gameId를 읽을 수 없습니다.' } }
  return [pscustomobject]@{ Ok = $true; GameId = $id; Error = $null }
}

function Get-ContentHash([byte[]]$Bytes) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes)) -replace '-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

# 마지막으로 보낸 경기나 같은 내용이면 보내지 않음
function Get-SendDecision($State, [string]$GameId, [string]$Hash) {
  if ($State.LastGameId -and $State.LastGameId -eq $GameId) { return 'same-game' }
  if ($State.LastHash -and $State.LastHash -eq $Hash) { return 'same-content' }
  return 'send'
}

function Read-State([string]$Path) {
  $state = [pscustomobject]@{ Folder = ''; LastGameId = ''; LastHash = '' }
  if (Test-Path -LiteralPath $Path) {
    try {
      $saved = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach ($k in 'Folder', 'LastGameId', 'LastHash') { if ($saved.$k) { $state.$k = [string]$saved.$k } }
    } catch {}
  }
  return $state
}

function Save-State([string]$Path, $State) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $State | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}

# 응답 본문은 UTF-8로 직접 읽음. Status 0은 서버에 닿지 못한 경우
function Send-Result([string]$Url, [string]$Key, [byte[]]$Bytes) {
  $res = $null
  try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = 'POST'
    $req.ContentType = 'text/csv; charset=utf-8'
    $req.Headers.Add('x-upload-key', $Key)
    $req.Headers.Add('x-file-name', $ResultFile)
    $req.Timeout = 30000
    $req.ContentLength = $Bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($Bytes, 0, $Bytes.Length)
    $stream.Close()
    $res = $req.GetResponse()
  } catch {
    $e = $_.Exception
    while ($e -and -not ($e -is [System.Net.WebException])) { $e = $e.InnerException }
    if ($e -and $e.Response) { $res = $e.Response }
    else { return [pscustomobject]@{ Status = 0; Message = $_.Exception.Message; RetryAfter = 0 } }
  }
  try {
    $status = [int]$res.StatusCode
    $retry = 0
    [void][int]::TryParse([string]$res.Headers['Retry-After'], [ref]$retry)
    $reader = New-Object System.IO.StreamReader($res.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $reader.ReadToEnd()
    $reader.Close()
  } finally { $res.Close() }
  $message = ''
  if ($text) { try { $message = [string]($text | ConvertFrom-Json).message } catch {} }
  return [pscustomobject]@{ Status = $status; Message = $message; RetryAfter = $retry }
}

function Show-Notice([string]$Text, [bool]$Bad = $false) {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Text)
  if (-not $script:Tray) { return }
  $icon = if ($Bad) { 'Error' } else { 'Info' }
  $script:Tray.ShowBalloonTip(5000, $Title, $Text, $icon)
}

# Windows Forms 형식은 Windows가 아니면 불러올 수 없어 함수 안에서만 씀
function New-Tray {
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $tray = New-Object System.Windows.Forms.NotifyIcon
    $tray.Icon = [System.Drawing.SystemIcons]::Information
    $tray.Text = 'Labs 결과 업로드'
    $tray.Visible = $true
    return $tray
  } catch { return $null }
}

function Get-Stamp([string]$Path) {
  $f = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
  if (-not $f) { return '' }
  return '{0}|{1}' -f $f.Length, $f.LastWriteTimeUtc.Ticks
}

# 게임이 파일을 다 쓸 때까지 크기와 수정 시각이 멈추고 파일이 열릴 때를 기다림
function Wait-Stable([string]$Path, [int]$Seconds = 3) {
  $prev = Get-Stamp $Path
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds $Seconds
    $cur = Get-Stamp $Path
    if ($cur -ne '' -and $cur -eq $prev) {
      try { $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'Read'); $fs.Close(); return $true } catch {}
    }
    $prev = $cur
  }
  return $false
}

# 결과 하나를 보내고 ok, skip, done, failed, stop 가운데 하나를 돌려줌
function Invoke-Upload([string]$Path, [string]$StatePath, $State, [int[]]$Delays = $RetryDelays) {
  try { $bytes = [System.IO.File]::ReadAllBytes($Path) } catch { Show-Notice "결과 파일을 읽지 못했습니다." $true; return 'failed' }
  $csv = Read-ResultCsv ([System.Text.Encoding]::UTF8.GetString($bytes))
  if (-not $csv.Ok) { Show-Notice "올리지 않았습니다. $($csv.Error)" $true; return 'skip' }
  $hash = Get-ContentHash $bytes
  $decision = Get-SendDecision $State $csv.GameId $hash
  if ($decision -ne 'send') { Write-Host "이미 보낸 결과라 건너뜁니다. gameId $($csv.GameId)"; return 'skip' }
  for ($try = 0; $try -le $Delays.Count; $try++) {
    $r = Send-Result $UploadUrl $UploadKey $bytes
    switch ($r.Status) {
      200 { $State.LastGameId = $csv.GameId; $State.LastHash = $hash; Save-State $StatePath $State; Show-Notice $r.Message; return 'ok' }
      409 { $State.LastGameId = $csv.GameId; $State.LastHash = $hash; Save-State $StatePath $State; Show-Notice $r.Message; return 'done' }
      { $_ -in 400, 413, 422 } { $State.LastHash = $hash; Save-State $StatePath $State; Show-Notice "올리지 못했습니다. $($r.Message)" $true; return 'done' }
      404 { Show-Notice '업로드 키가 폐기됐거나 대회가 없어 멈춥니다.' $true; return 'stop' }
      410 { Show-Notice "$($r.Message) 업로드를 멈춥니다." $true; return 'stop' }
    }
    if ($try -lt $Delays.Count) {
      $wait = [Math]::Max($Delays[$try], $r.RetryAfter)
      Write-Host "보내지 못해 $($wait)초 뒤 다시 시도합니다. ($($r.Status) $($r.Message))"
      Start-Sleep -Seconds $wait
    }
  }
  Show-Notice '서버에 보내지 못했습니다. 다음 결과를 저장할 때 다시 시도합니다.' $true
  return 'failed'
}

# 테스트에서 점 소싱하면 함수만 불러옴
if ($MyInvocation.InvocationName -eq '.') { return }

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$stateDir = if ($env:APPDATA) { Join-Path $env:APPDATA 'labs-upload' } else { $PSScriptRoot }
$StatePath = Join-Path $stateDir ((Get-ContentHash ([System.Text.Encoding]::UTF8.GetBytes($UploadKey))).Substring(0, 16) + '.json')
$State = Read-State $StatePath

if ($Folder) { $State.Folder = $Folder }
while (-not $State.Folder -or -not (Test-Path -LiteralPath $State.Folder -PathType Container)) {
  $base = if ($State.Folder) { $State.Folder } else { $DefaultFolder }
  Write-Host "결과 폴더: $base"
  $typed = Read-Host 'Enter를 누르면 이 폴더를 씁니다. 다른 폴더면 경로를 입력하세요'
  $pick = if ($typed.Trim()) { $typed.Trim().Trim('"') } else { $base }
  if (Test-Path -LiteralPath $pick -PathType Container) { $State.Folder = $pick } else { Write-Host '없는 폴더입니다.'; $State.Folder = '' }
}
Save-State $StatePath $State
$Path = Join-Path $State.Folder $ResultFile

$script:Tray = New-Tray

try {
  Write-Host "$Title 결과 업로드를 시작합니다. 끝내려면 이 창을 닫거나 Ctrl+C를 누르세요."
  Write-Host "감시하는 파일: $Path"
  # 켜기 전에 있던 결과는 지난 경기일 수 있어 물어봄
  if (Test-Path -LiteralPath $Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $csv = Read-ResultCsv ([System.Text.Encoding]::UTF8.GetString($bytes))
    if ($csv.Ok -and (Get-SendDecision $State $csv.GameId (Get-ContentHash $bytes)) -eq 'send') {
      $answer = Read-Host "지금 있는 결과(gameId $($csv.GameId))도 올릴까요? (y/N)"
      if ($answer -match '^[yY]') {
        if ((Invoke-Upload $Path $StatePath $State) -eq 'stop') { return }
      } else {
        $State.LastHash = Get-ContentHash $bytes
        Save-State $StatePath $State
      }
    }
  }
  $watcher = New-Object System.IO.FileSystemWatcher($State.Folder, $ResultFile)
  $watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, Size, CreationTime'
  $last = Get-Stamp $Path
  while ($true) {
    [void]$watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 5000)
    $stamp = Get-Stamp $Path
    if ($stamp -eq '' -or $stamp -eq $last) { continue }
    if (-not (Wait-Stable $Path)) { continue }
    $last = Get-Stamp $Path
    if ((Invoke-Upload $Path $StatePath $State) -eq 'stop') { break }
  }
} finally {
  if ($watcher) { $watcher.Dispose() }
  if ($script:Tray) { $script:Tray.Visible = $false; $script:Tray.Dispose() }
}
