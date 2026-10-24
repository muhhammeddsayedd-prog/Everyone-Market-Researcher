[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$secret=$null;$stream=$null;$leaseStream=$null;$created=$false;$leaseCreated=$false;$success=$false
try{
 $directory=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
 $cursor=$directory
 while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force;if(-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
 $handoff=Join-Path $directory 'emr-m03-foundation-management.dpapi'
 $lease=Join-Path $directory 'emr-m03-foundation-management.lease.json'
 if((Test-Path -LiteralPath $handoff) -or (Test-Path -LiteralPath $lease)){throw 'blocked'}
 $secret=Read-Host 'EXISTING muhhammedsayed n8n management API key, owned INACTIVE M03 workflow provisioning only' -AsSecureString
 if($secret.Length -eq 0 -or $secret.Length -gt 4096){throw 'blocked'}
 $cipher=ConvertFrom-SecureString -SecureString $secret
 $stream=[IO.File]::Open($handoff,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$created=$true
 $bytes=[Text.Encoding]::ASCII.GetBytes($cipher);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)
 $now=[DateTimeOffset]::UtcNow
 $metadata=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';purpose='m03_owned_inactive_provision';createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o')}
 $leaseStream=[IO.File]::Open($lease,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$leaseCreated=$true
 $bytes=[Text.Encoding]::UTF8.GetBytes(($metadata|ConvertTo-Json -Compress));$leaseStream.Write($bytes,0,$bytes.Length);$leaseStream.Flush($true);$success=$true
}catch{
 # Hidden input, ciphertext and native/private exceptions are never emitted.
}finally{
 if($null -ne $stream){$stream.Dispose()};if($null -ne $leaseStream){$leaseStream.Dispose()};if($null -ne $secret){$secret.Dispose()}
 $secret=$null;$cipher=$null
 if(-not $success){if($created){try{[IO.File]::Delete($handoff)}catch{}};if($leaseCreated){try{[IO.File]::Delete($lease)}catch{}}}
}
if(-not $success){Write-Output 'M03_FOUNDATION_HANDOFF_NOT_CREATED. Existing files preserved; no private value printed.';exit 1}
Write-Output 'M03_FOUNDATION_MANAGEMENT_READY. Two-hour encrypted purpose-bound handoff saved; no authentication performed. Close this PowerShell window and retain the existing original key.'
exit 0
