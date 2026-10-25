[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

# One exact, physically closed, GET-only attempt. This is cleanup authority,
# never another admission, credential consumer or database/Vercel operation.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$segment='a570212a-634c-444f-90a2-578ae47e8d27'
$window='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
$application='f42930f90c2de43c84f61ad6d966d0ee6074d70e'
$admissionRelative='scripts/n8n/out/foundation/live/postcheck-continuation-'+$segment+'.json'
$claimRelative='scripts/n8n/out/foundation/live/postcheck-continuation-'+$segment+'.runtime-claim.json'
$dbRelative='scripts/db/out/m03-foundation-postcheck-continuation-'+$segment+'-latest.json'
$lock=$null;$lockIdentity=$null;$leaf=$null;$deleted=$false;$absent=$false;$success=$false

function Assert-ExactKeys($Value,[string[]]$Keys) {
  if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($Keys|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}
}
function Assert-ClosedAttempt($v) {
  if($v.kind -cne 'm03_postcheck_continuation_actual_attempt' -or $v.version -isnot [int] -or $v.version -ne 1 -or
     $v.deliveryHead -cne '10e40c717a23445e03cf791171a3118406533b69' -or $v.applicationSource -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or
     $v.segmentId -cne 'a570212a-634c-444f-90a2-578ae47e8d27' -or $v.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or
     $v.clock.startsAtUtc -cne '2026-10-21T18:40:52.488Z' -or $v.clock.parentProcessId -ne 49728 -or $v.clock.runtimeProcessId -ne 12200 -or
     $v.postClosurePresence.observedAtUtc -cne '2026-10-21T18:43:59.6765604Z' -or
     $v.prepareResult.managementAttempts -ne 1 -or $v.prepareResult.controlAttempts -ne 100 -or
     $v.prepareResult.nativeExecutions -ne 0 -or $v.prepareResult.gatewayPreflightAttempts -ne 0 -or $v.prepareResult.providerDirectAttempts -ne 0 -or $v.prepareResult.actorStarts -ne 0 -or
     $v.database.runId -cne '3860e4ad-eac9-4b19-a08f-6dce4c79a372' -or $v.database.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or
     $v.database.historyBefore -cne 'complete' -or $v.database.historyAfter -cne 'complete' -or $v.database.migrationCount -ne 14 -or
     $v.database.postcheckStage -cne 'complete' -or $v.database.migrationsAppliedThisAttempt -ne 0 -or
     $v.setup.exactRows -ne 1 -or $v.setup.writeIntents -ne 0 -or $v.setup.environmentWrites -ne 0 -or $v.setup.workflowTransitions -ne 0 -or
     $v.coordinatorClose.status -cne 'closed' -or $v.wrapperClose.nativeExit -ne 1){throw 'blocked'}
  foreach($pair in @(
    @($v.clock.oneUseConsumed,$true),@($v.clock.automaticRenewalOrSecondChildAuthorized,$false),
    @($v.database.authenticationVerified,$true),@($v.database.dryRunAttempted,$false),@($v.database.pushAttempted,$false),
    @($v.database.unprovisionedFixtureArchived,$true),@($v.database.ownerProvisionIntentPresent,$false),@($v.database.phaseAClosed,$false),
    @($v.database.childrenClosed,$true),@($v.database.handoffDeleted,$true),@($v.database.leaseDeleted,$true),@($v.database.scratchDeleted,$true),
    @($v.setup.previewCreated,$false),@($v.setup.bypassInstalledRemotely,$false),@($v.setup.sqlWindowProvisioned,$false),
    @($v.coordinatorClose.childTransportsClosed,$true),@($v.coordinatorClose.adminChildClosed,$true),@($v.coordinatorClose.windowClosed,$false),
    @($v.coordinatorClose.fixtureArchived,$true),@($v.coordinatorClose.environmentCleanupVerified,$true),@($v.coordinatorClose.remoteWorkSettled,$false),@($v.coordinatorClose.residual,$true),
    @($v.wrapperClose.childClosed,$true),@($v.wrapperClose.credentialChildrenClosed,$true),@($v.wrapperClose.handoffsDeleted,$true),
    @($v.wrapperClose.bypassHandoffDeleted,$false),@($v.wrapperClose.pendingMachinePreserved,$true),
    @($v.postClosurePresence.allEightAdminRuntimeTemporaryFilesAbsent,$true),@($v.postClosurePresence.parentLockAbsent,$true),
    @($v.postClosurePresence.unusedUninstalledBypassCiphertextPresent,$true),@($v.acceptance.fullD,$false)
  )){if($pair[0] -isnot [bool] -or $pair[0] -ne $pair[1]){throw 'blocked'}}
}
function Assert-LeafTimes([DateTime]$Creation,[DateTime]$Write) {
  $first=[DateTimeOffset]::Parse('2026-10-21T18:40:52.488Z',[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
  $last=[DateTimeOffset]::Parse('2026-10-21T18:43:59.6765604Z',[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
  if($Creation.Kind -ne [DateTimeKind]::Utc -or $Write.Kind -ne [DateTimeKind]::Utc -or $Creation -lt $first -or $Creation -gt $last -or $Write -lt $Creation -or $Write -gt $last){throw 'blocked'}
}
function Assert-OrdinaryAncestors([string]$Path,[switch]$Directory) {
  $full=[IO.Path]::GetFullPath($Path)
  $current=if($Directory){$full}else{[IO.Path]::GetDirectoryName($full)}
  while(-not [string]::IsNullOrEmpty($current)){
    $attributes=[IO.File]::GetAttributes($current)
    if(($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or ($attributes -band [IO.FileAttributes]::Directory) -eq 0){throw 'blocked'}
    $parent=[IO.Directory]::GetParent($current);$current=if($null -eq $parent){$null}else{$parent.FullName}
  }
  return $full
}
function Assert-Absent([string]$Path) {
  $null=Assert-OrdinaryAncestors $Path
  try{$null=[IO.File]::GetAttributes($Path);throw 'blocked'}catch [IO.FileNotFoundException]{}catch [IO.DirectoryNotFoundException]{throw 'blocked'}
}
function Assert-ProcessesAbsent {
  foreach($number in @(49728,12200)){
    $process=$null
    try{$process=[Diagnostics.Process]::GetProcessById($number);throw 'blocked'}catch [ArgumentException]{}finally{if($null -ne $process){$process.Dispose()}}
  }
}
function Read-ExactPublic([string]$Relative,[string]$Hash,[switch]$Text) {
  $path=[IO.Path]::GetFullPath((Join-Path $repo $Relative))
  if(-not $path.StartsWith($repo.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $null=Assert-OrdinaryAncestors $path
  $handle=$null;$stream=$null;$digest=$null
  try{
    $handle=[EmrM03UnusedBypassNative]::Open($path,$true)
    $info=[EmrM03UnusedBypassNative]::Inspect($handle)
    if(($info.Attributes -band 0x410) -ne 0 -or $info.NumberOfLinks -ne 1){throw 'blocked'}
    $stream=[IO.FileStream]::new($handle,[IO.FileAccess]::Read)
    if($stream.Length -le 0 -or $stream.Length -gt 2097152){throw 'blocked'}
    $digest=[Security.Cryptography.SHA256]::Create()
    $actual=[BitConverter]::ToString($digest.ComputeHash($stream)).Replace('-','').ToLowerInvariant()
    if($actual -cne $Hash){throw 'blocked'}
    $stream.Position=0;$reader=[IO.StreamReader]::new($stream,[Text.UTF8Encoding]::new($false,$true),$false,4096,$true)
    try{$value=$reader.ReadToEnd()}finally{$reader.Dispose()}
    if($Text){return $value}
    return ConvertFrom-Json -InputObject $value -ErrorAction Stop
  }finally{if($null -ne $digest){$digest.Dispose()};if($null -ne $stream){$stream.Dispose()};if($null -ne $handle){$handle.Dispose()}}
}
function Assert-Journals {
  $management=Read-ExactPublic 'scripts/n8n/out/foundation/live/management.jsonl' '3d47a19f2481c5e7663c8d0624394fb36c3bc158394bb57bb1c5bc1f2089bcbd' -Text
  $control=Read-ExactPublic 'scripts/n8n/out/foundation/live/control.jsonl' 'b5c392a9a82ce35df84c8f9949bf64f21dccc9aded838285a321468a3c213cef' -Text
  $setup=Read-ExactPublic 'scripts/n8n/out/foundation/live/setup.jsonl' '4dec713080ced4f0a752e559202e2090cf69fb33cf2c1e3fa180e8549229daf6' -Text
  foreach($text in @($management,$control,$setup)){if(-not $text.EndsWith("`n",[StringComparison]::Ordinal)){throw 'blocked'}}
  $rows=@($management.TrimEnd("`n").Split("`n")|ForEach-Object{ConvertFrom-Json -InputObject $_})
  if($rows.Count -ne 2){throw 'blocked'}
  Assert-ExactKeys $rows[0] @('event','version','sourceCommitSha','deadlineAt');Assert-ExactKeys $rows[1] @('event','ordinal')
  if($rows[0].event -cne 'management_header' -or $rows[0].version -ne 1 -or $rows[0].sourceCommitSha -cne $application -or $rows[0].deadlineAt -ne 1792584023481 -or $rows[1].event -cne 'management_attempt' -or $rows[1].ordinal -ne 1){throw 'blocked'}
  $rows=@($control.TrimEnd("`n").Split("`n")|ForEach-Object{ConvertFrom-Json -InputObject $_})
  if($rows.Count -ne 100){throw 'blocked'}
  $counts=@{}
  for($i=0;$i -lt 100;$i++){
    $row=$rows[$i];Assert-ExactKeys $row @('event','ordinal','kind','workflowId','at')
    if($row.event -cne 'control_request_intent' -or $row.ordinal -ne $i+1 -or $row.kind -cne 'discovery' -or $row.workflowId -isnot [string] -or $row.workflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $row.at -isnot [string]){throw 'blocked'}
    if(-not $counts.ContainsKey($row.workflowId)){$counts[$row.workflowId]=0};$counts[$row.workflowId]++
  }
  if($counts.Count -ne 25 -or @($counts.Values|Where-Object{$_ -ne 4}).Count -ne 0){throw 'blocked'}
  $rows=@($setup.TrimEnd("`n").Split("`n")|ForEach-Object{ConvertFrom-Json -InputObject $_})
  if($rows.Count -ne 1){throw 'blocked'}
  Assert-ExactKeys $rows[0] @('event','ordinal','kind','at')
  if($rows[0].event -cne 'setup_attempt' -or $rows[0].ordinal -ne 1 -or $rows[0].kind -cne 'GET' -or $rows[0].at -ne 1792608136543){throw 'blocked'}
  foreach($entry in @(Get-ChildItem -LiteralPath (Join-Path $repo 'scripts/n8n/out/foundation/live') -Filter '*.jsonl' -Force)){
    if($entry.Name -cnotin @('management.jsonl','control.jsonl','setup.jsonl')){throw 'blocked'}
  }
}
function Assert-ActualPublicProof {
  $proof=Read-ExactPublic 'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json' 'b984ec79c857468822e9299dd59fc2b26d71a26bb6b324dd90ecbaa7f39d1fcd'
  Assert-ClosedAttempt $proof
  $admission=Read-ExactPublic $admissionRelative 'e9b04ba5db824fbb72cbb4f74bcd00885a56ace3e270b1ff73ba79097daaa9cc'
  Assert-ExactKeys $admission @('kind','version','segmentId','sourceCommitSha','windowId','approvalSha256','startsAt','deadlineAt','stopNewAt','hardDeadlineAt','parentProcessId')
  $start=[DateTimeOffset]::Parse('2026-10-21T18:40:52.488Z',[Globalization.CultureInfo]::InvariantCulture).ToUnixTimeMilliseconds()
  if($admission.kind -cne 'm03_postcheck_continuation_admission' -or $admission.version -ne 1 -or $admission.segmentId -cne $segment -or $admission.sourceCommitSha -cne $application -or $admission.windowId -cne $window -or $admission.approvalSha256 -cne 'ab24cf3488a0990988550ec361a7bbe4f147d0bce5a62a5aa5d2eb9cdf17e19a' -or $admission.parentProcessId -ne 49728 -or $admission.startsAt -ne $start -or $admission.deadlineAt -ne $start+3600000 -or $admission.stopNewAt -ne $start+3000000 -or $admission.hardDeadlineAt -ne $start+4200000){throw 'blocked'}
  $claim=Read-ExactPublic $claimRelative 'f3e5f4560b05c3b62d148006b1f3793df6a984727cdd45a028c11a96ddc24f03'
  Assert-ExactKeys $claim @('kind','version','segmentId','admissionSha256','processId','parentProcessId')
  if($claim.kind -cne 'm03_postcheck_continuation_runtime_claim' -or $claim.version -ne 1 -or $claim.segmentId -cne $segment -or $claim.admissionSha256 -cne 'e9b04ba5db824fbb72cbb4f74bcd00885a56ace3e270b1ff73ba79097daaa9cc' -or $claim.processId -ne 12200 -or $claim.parentProcessId -ne 49728){throw 'blocked'}
  $db=Read-ExactPublic $dbRelative '4bb72ca4728010273ab2e8332c87f707ada4d1a82e744db8412760a21a45b865'
  if($db.version -ne 1 -or $db.runId -cne '3860e4ad-eac9-4b19-a08f-6dce4c79a372' -or $db.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $db.environment -cne 'dev' -or $db.host -cne 'aws-1-eu-central-1.pooler.supabase.com' -or $db.port -ne 5432 -or $db.clockSegmentId -cne $segment -or $db.historyBefore -cne 'complete' -or $db.historyAfter -cne 'complete' -or $db.dryRunCheck -cne 'not_attempted' -or $db.postcheckStage -cne 'complete' -or $db.pendingVersions -isnot [Array] -or $db.pendingVersions.Count -ne 0 -or $db.postcheckCandidate -cne 'scripts/db/out/m03-foundation-continuation-3860e4ad-eac9-4b19-a08f-6dce4c79a372-db.types.ts'){throw 'blocked'}
  foreach($pair in @(@($db.authenticationVerified,$true),@($db.pushAttempted,$false),@($db.postcheckContinuation,$true),@($db.phaseAControl,$true),@($db.unprovisionedFixtureArchived,$true),@($db.phaseAClosed,$false),@($db.childrenClosed,$true),@($db.handoffDeleted,$true),@($db.leaseDeleted,$true),@($db.scratchDeleted,$true))){if($pair[0] -isnot [bool] -or $pair[0] -ne $pair[1]){throw 'blocked'}}
  $null=Read-ExactPublic 'scripts/db/out/m03-foundation-continuation-3860e4ad-eac9-4b19-a08f-6dce4c79a372-db.types.ts' 'baa632751cc0f74543be52ae0405934f7fe8254b55ddf5e171ea6e1b3a3f1ed8' -Text
  Assert-Journals
  foreach($relative in @('scripts/n8n/out/foundation/live/runtime.operation.lock','scripts/n8n/out/foundation/live/runtime.jsonl','scripts/n8n/out/foundation/live/preflight.jsonl','scripts/db/out/m03-foundation-owner-provision-attempt.json',('scripts/db/out/m03-foundation-postcheck-continuation-'+$segment+'-owner-provision-attempt.json'))){Assert-Absent (Join-Path $repo $relative)}
}

try{
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class EmrM03UnusedBypassNative {
  [StructLayout(LayoutKind.Sequential)] public struct Info {
    public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
    public uint VolumeSerialNumber, FileSizeHigh, FileSizeLow, NumberOfLinks, FileIndexHigh, FileIndexLow;
    public DateTime Created { get { return DateTime.FromFileTimeUtc(((long)(uint)CreationTime.dwHighDateTime<<32)|(uint)CreationTime.dwLowDateTime); } }
    public DateTime Written { get { return DateTime.FromFileTimeUtc(((long)(uint)LastWriteTime.dwHighDateTime<<32)|(uint)LastWriteTime.dwLowDateTime); } }
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
  private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true)]
  private static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
  public static SafeFileHandle Open(string path,bool publicContent) {
    // The ciphertext handle has FILE_READ_ATTRIBUTES only, not FILE_READ_DATA.
    var handle=CreateFileW(path,publicContent?0x80000080u:0x80u,5,IntPtr.Zero,3,0x00200000,IntPtr.Zero);
    if(handle.IsInvalid){handle.Dispose();throw new InvalidOperationException("blocked");}return handle;
  }
  public static Info Inspect(SafeFileHandle handle){Info value;if(!GetFileInformationByHandle(handle,out value))throw new InvalidOperationException("blocked");return value;}
  public static bool Same(Info a,Info b){return a.VolumeSerialNumber==b.VolumeSerialNumber && a.FileIndexHigh==b.FileIndexHigh && a.FileIndexLow==b.FileIndexLow && a.Attributes==b.Attributes && a.NumberOfLinks==b.NumberOfLinks && a.Created==b.Created && a.Written==b.Written;}
}
'@ -ErrorAction Stop
  $local=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  if([string]::IsNullOrWhiteSpace($local) -or [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA) -or [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') -cne [IO.Path]::GetFullPath($local).TrimEnd('\')){throw 'blocked'}
  $directory=Assert-OrdinaryAncestors (Join-Path $local 'Temp') -Directory
  $target=[IO.Path]::GetFullPath((Join-Path $directory 'emr-m03-acceptance-protection-bypass.dpapi'))
  if([IO.Path]::GetDirectoryName($target) -cne $directory -or [IO.Path]::GetFileName($target) -cne 'emr-m03-acceptance-protection-bypass.dpapi'){throw 'blocked'}
  $lockPath=Join-Path $directory 'emr-m03-acceptance-parent.operation.lock'
  Assert-Absent $lockPath;Assert-ProcessesAbsent
  $lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $lockIdentity=[EmrM03UnusedBypassNative]::Inspect($lock.SafeFileHandle)
  $marker=[Text.Encoding]::ASCII.GetBytes('m03-unused-bypass-cleanup-v1');$lock.Write($marker,0,$marker.Length);$lock.Flush($true)
  # All public and absence predicates are evaluated while the admission lock is held.
  Assert-ProcessesAbsent;Assert-ActualPublicProof
  foreach($stem in @('emr-m03-acceptance-management','emr-m03-acceptance-writer','emr-m03-acceptance-apifyread','emr-m03-foundation-dev-migration-password')){foreach($suffix in @('.dpapi','.lease.json')){Assert-Absent (Join-Path $directory ($stem+$suffix))}}
  try{$null=[IO.File]::GetAttributes($target)}catch [IO.FileNotFoundException]{$absent=$true}
  if(-not $absent){
    $null=Assert-OrdinaryAncestors $target
    $leaf=[EmrM03UnusedBypassNative]::Open($target,$false)
    $before=[EmrM03UnusedBypassNative]::Inspect($leaf)
    if(($before.Attributes -band 0x410) -ne 0 -or $before.NumberOfLinks -ne 1){throw 'blocked'}
    Assert-LeafTimes $before.Created $before.Written
    Assert-ProcessesAbsent
    $null=Assert-OrdinaryAncestors $target
    $check=[EmrM03UnusedBypassNative]::Open($target,$false)
    try{$after=[EmrM03UnusedBypassNative]::Inspect($check);if(-not [EmrM03UnusedBypassNative]::Same($before,$after)){throw 'blocked'}}finally{$check.Dispose()}
    Remove-Item -LiteralPath $target -ErrorAction Stop
    $deleted=$true;$absent=-not (Test-Path -LiteralPath $target)
    if(-not $absent){throw 'blocked'}
  }
  $success=$true
}catch{
  # No native exception, path, file data or credential-derived value is emitted.
}finally{
  if($null -ne $leaf){$leaf.Dispose()}
  if($null -ne $lock){
    $lock.Dispose()
    try{
      if($null -eq $lockIdentity){throw 'blocked'}
      $handle=[EmrM03UnusedBypassNative]::Open($lockPath,$false)
      try{$current=[EmrM03UnusedBypassNative]::Inspect($handle);if($current.VolumeSerialNumber -ne $lockIdentity.VolumeSerialNumber -or $current.FileIndexHigh -ne $lockIdentity.FileIndexHigh -or $current.FileIndexLow -ne $lockIdentity.FileIndexLow -or $current.NumberOfLinks -ne 1 -or ($current.Attributes -band 0x410) -ne 0){throw 'blocked'}}finally{$handle.Dispose()}
      Remove-Item -LiteralPath $lockPath -ErrorAction Stop
      if(Test-Path -LiteralPath $lockPath){throw 'blocked'}
    }catch{$success=$false}
  }
}
[ordered]@{status=$(if($success){'unused_bypass_cleanup_verified'}else{'unused_bypass_cleanup_blocked'});deleted=$deleted;absent=$absent;privateContentsRead=$false;networkRequests=0}|ConvertTo-Json -Compress
if(-not $success){exit 1}
exit 0
