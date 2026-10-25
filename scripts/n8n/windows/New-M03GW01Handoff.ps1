[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Writer','Admin','Machine','ProtectionBypass','Management')][string]$Kind)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$secret=$null; $stream=$null; $ciphertext=$null; $randomBytes=$null; $rng=$null; $plain=$null; $created=$false; $success=$false
$names=@{ Writer='emr-m03-gw01-dev-writer.dpapi'; Admin='emr-m03-gw01-dev-admin.dpapi'; Machine='emr-m03-gw01-dev-machine.dpapi'; ProtectionBypass='emr-m03-gw01-dev-protection.dpapi'; Management='emr-m03-gw01-dev-management.dpapi' }
try {
  if([string]::IsNullOrEmpty($env:LOCALAPPDATA)){throw 'blocked'}
  if($Kind -cin @('Writer','Machine','ProtectionBypass')){
    $repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    $gateFile=Join-Path $repo 'scripts\n8n\gw01-cloud-privacy.json'
    $gateEntry=Get-Item -LiteralPath $gateFile -Force -ErrorAction Stop
    if($gateEntry.PSIsContainer -or ($gateEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $gateEntry.Length -gt 16384){throw 'blocked'}
    $gate=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($gateFile)) -ErrorAction Stop
    if($gate.version -ne 1 -or $gate.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $gate.instanceHost -cne 'muhhammedsayed.app.n8n.cloud' -or
      $gate.credentialCanaryVerified -isnot [bool] -or $gate.credentialCanaryVerified -ne $true -or
      $gate.executionCanaryVerified -isnot [bool] -or $gate.executionCanaryVerified -ne $true -or $gate.exportCanaryVerified -isnot [bool] -or $gate.exportCanaryVerified -ne $true -or
      $gate.ownedWorkflowId -isnot [string] -or $gate.ownedWorkflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$'){throw 'blocked'}
    if($Kind -cne 'ProtectionBypass' -and ($gate.passed -isnot [bool] -or $gate.passed -ne $true -or $gate.logCanaryVerified -isnot [bool] -or $gate.logCanaryVerified -ne $true)){throw 'blocked'}
  }
  $directory=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
  $cursor=$directory
  while($null -ne $cursor){
    $entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if(-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    $parent=[IO.Directory]::GetParent($cursor)
    $cursor=if($null -eq $parent){$null}else{$parent.FullName}
  }
  $file=Join-Path $directory $names[$Kind]
  if(Test-Path -LiteralPath $file){throw 'blocked'}
  switch($Kind){
    'Writer' { $secret=Read-Host 'EXISTING emr-dev n8n_writer password (not postgres, prod or api_agent)' -AsSecureString }
    'Admin' { $secret=Read-Host 'EXISTING emr-dev postgres password for the ONE additive GW-01 migration only' -AsSecureString }
    'ProtectionBypass' { $secret=Read-Host 'NEW GW-01-only Vercel protection bypass (not existing/default entries)' -AsSecureString }
    'Management' { $secret=Read-Host 'EXISTING n8n management API key for GW-01 owned credential/workflow delivery only' -AsSecureString }
    'Machine' {
      $randomBytes=New-Object byte[] 32
      $rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($randomBytes)
      $plain=[Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
      $secret=ConvertTo-SecureString -String $plain -AsPlainText -Force
      $plain=$null
    }
  }
  if($null -eq $secret -or $secret.Length -eq 0 -or $secret.Length -gt 4096){throw 'blocked'}
  $ciphertext=ConvertFrom-SecureString -SecureString $secret -ErrorAction Stop
  $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $created=$true
  $bytes=[Text.Encoding]::ASCII.GetBytes($ciphertext)
  $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)
  if($Kind -ceq 'Management'){
    $leaseFile=Join-Path $directory 'emr-m03-gw01-dev-management.lease.json'
    $leaseStream=$null
    try{
      $leaseStream=[IO.File]::Open($leaseFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
      $now=[DateTimeOffset]::UtcNow
      $lease=[ordered]@{version=1;windowId='76c2ad42-c094-4ba4-9a0b-566e19b97780';createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o')}
      $leaseBytes=[Text.Encoding]::UTF8.GetBytes(($lease|ConvertTo-Json -Compress))
      $leaseStream.Write($leaseBytes,0,$leaseBytes.Length);$leaseStream.Flush($true)
    }finally{if($null -ne $leaseStream){$leaseStream.Dispose()}}
  }
  $success=$true
}catch{
  # No hidden input, generated token, hash, ciphertext or exception is emitted.
}finally{
  if($null -ne $stream){$stream.Dispose()}
  if($null -ne $secret){$secret.Dispose()}
  if($null -ne $rng){$rng.Dispose()}
  if($null -ne $randomBytes){[Array]::Clear($randomBytes,0,$randomBytes.Length)}
  $secret=$null;$ciphertext=$null;$plain=$null
  if($created -and -not $success){try{[IO.File]::Delete($file)}catch{}}
}
if(-not $success){Write-Output 'GW01_HANDOFF_NOT_CREATED. Existing files preserved; no private value or authentication output.';exit 1}
Write-Output ('GW01_ENCRYPTED_HANDOFF_READY: '+$Kind+'. No authentication or delivery performed. Close this PowerShell window; keep separately saved existing passwords.')
exit 0
