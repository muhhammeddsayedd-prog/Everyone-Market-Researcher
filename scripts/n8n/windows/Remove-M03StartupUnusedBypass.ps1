Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo='D:\Everyone\everyone Market Research\everyone-market-radar'
$lock=$null;$leaf=$null;$deleted=$false;$success=$false
function Read-Public([string]$Relative,[string]$Hash) {
  $path=Join-Path $repo $Relative
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Hash){throw 'blocked'}
  return [IO.File]::ReadAllText($path)
}
function Assert-Absent([string]$Path){if(Test-Path -LiteralPath $Path){throw 'blocked'}}
function Assert-Parents([string]$Path){
  $cursor=[IO.Path]::GetDirectoryName($Path)
  while($cursor){$a=[IO.File]::GetAttributes($cursor);if(($a -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or ($a -band [IO.FileAttributes]::Directory) -eq 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}}
}
try {
  # Reuse only the previously reviewed metadata-only native class, not its
  # historical cleanup entrypoint or historical authority predicates.
  $source=Read-Public 'scripts/n8n/windows/Remove-M03PostcheckUnusedBypass.ps1' '7154a3104b643c99b796dfd3b6dceb29439444a9fa9e8827650dbfdd1f19ef9e'
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
  if($errors.Count -ne 0){throw 'blocked'}
  $native=@($ast.FindAll({param($v) $v -is [Management.Automation.Language.StringConstantExpressionAst] -and $v.Value.Contains('public static class EmrM03UnusedBypassNative')},$true))
  if($native.Count -ne 1){throw 'blocked'}
  Add-Type -TypeDefinition $native[0].Value -ErrorAction Stop
  $local=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  if([IO.Path]::GetFullPath($local) -cne [IO.Path]::GetFullPath($env:LOCALAPPDATA)){throw 'blocked'}
  $directory=[IO.Path]::GetFullPath((Join-Path $local 'Temp'))
  $target=[IO.Path]::GetFullPath((Join-Path $directory 'emr-m03-acceptance-protection-bypass.dpapi'))
  if([IO.Path]::GetDirectoryName($target) -cne $directory){throw 'blocked'}
  Assert-Parents $target
  $lockPath=Join-Path $directory 'emr-m03-acceptance-parent.operation.lock'
  Assert-Absent $lockPath
  $lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  foreach($id in @(44408,60040)){if(Get-Process -Id $id -ErrorAction SilentlyContinue){throw 'blocked'}}
  foreach($stem in @('emr-m03-foundation-dev-migration-password','emr-m03-acceptance-management','emr-m03-acceptance-writer','emr-m03-acceptance-apifyread')){foreach($suffix in @('.dpapi','.lease.json')){Assert-Absent (Join-Path $directory ($stem+$suffix))}}
  Assert-Absent (Join-Path $repo 'scripts/n8n/out/foundation/live/runtime.operation.lock')
  Assert-Absent (Join-Path $repo 'scripts/db/out/m03-foundation-startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4-owner-provision-attempt.json')
  $setup=Read-Public 'scripts/n8n/out/foundation/live/setup.jsonl' 'e4e039e57925811bdc4b4246031f7de095e5e6a021814679638a720a88dbb917'
  $rows=@($setup.Trim().Split("`n")|ForEach-Object{$_|ConvertFrom-Json})
  if($rows.Count -ne 2){throw 'blocked'}
  for($i=0;$i -lt 2;$i++){if($rows[$i].event -cne 'setup_attempt' -or $rows[$i].kind -cne 'GET' -or $rows[$i].ordinal -ne $i+1){throw 'blocked'}}
  $journal=Read-Public 'scripts/n8n/out/foundation/live/startup-supervisor-1c69c89e-7807-46d5-b7b8-ca28285ff2b4.jsonl' '5cd091876c5426fa1f6880a24bd66cb790de3e20479950f01b702017701f66dd'
  $events=@($journal.Trim().Split("`n")|ForEach-Object{$_|ConvertFrom-Json})
  $closed=@($events|Where-Object{$_.kind -ceq 'm03_acceptance_closed'})
  $wrapped=@($events|Where-Object{$_.kind -ceq 'm03_acceptance_wrapper_closed'})
  $outer=@($events|Where-Object{$_.kind -ceq 'public_supervisor_outer_exit'})
  if($closed.Count -ne 1 -or $wrapped.Count -ne 1 -or $outer.Count -ne 1 -or $closed[0].environmentCleanupVerified -ne $true -or $wrapped[0].credentialChildrenClosed -ne $true -or $wrapped[0].childClosed -ne $true -or $wrapped[0].handoffsDeleted -ne $true -or $outer[0].stdoutEnded -ne $true -or $outer[0].nativeExit -ne 1){throw 'blocked'}
  $leaf=[EmrM03UnusedBypassNative]::Open($target,$false)
  $before=[EmrM03UnusedBypassNative]::Inspect($leaf)
  if(($before.Attributes -band 0x410) -ne 0 -or $before.NumberOfLinks -ne 1 -or $before.Created -lt [DateTime]::Parse('2026-10-22T10:52:53.414Z').ToUniversalTime() -or $before.Written -lt $before.Created -or $before.Written -gt [DateTime]::Parse('2026-10-22T10:57:00.225Z').ToUniversalTime()){throw 'blocked'}
  $check=[EmrM03UnusedBypassNative]::Open($target,$false)
  try{if(-not [EmrM03UnusedBypassNative]::Same($before,[EmrM03UnusedBypassNative]::Inspect($check))){throw 'blocked'}}finally{$check.Dispose()}
  Remove-Item -LiteralPath $target -ErrorAction Stop
  $deleted=$true
  Assert-Absent $target
  $success=$true
} catch {
  # Fixed output only; no private file contents or native errors are emitted.
} finally {
  if($leaf){$leaf.Dispose()}
  if($lock){$lock.Dispose();try{Remove-Item -LiteralPath $lockPath -ErrorAction Stop;Assert-Absent $lockPath}catch{$success=$false}}
}
[ordered]@{status=$(if($success){'startup_unused_bypass_deleted'}else{'startup_unused_bypass_cleanup_blocked'});deleted=$deleted;privateContentsRead=$false;networkRequests=0;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress
if(-not $success){exit 1}
