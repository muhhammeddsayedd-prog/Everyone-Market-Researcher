[CmdletBinding()]
param([ValidateSet('CheckOnly','Apply')][string]$Mode='CheckOnly')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

# One closed local attempt only. No authentication, child launch or remote call.
# This cannot identify an unknown orphan whose departed parent was not captured.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$segment='e8035391-dba8-48c9-97e0-139ba980d86e'
$live=Join-Path $repo 'scripts/n8n/out/foundation/live'
$stem='remaining-closed-cleanup-'+$segment
$intentPath=Join-Path $live ($stem+'.intent.json')
$resultPath=Join-Path $live ($stem+'.result.json')
$publicStreams=[Collections.Generic.List[IO.FileStream]]::new()
$handles=[Collections.Generic.List[object]]::new()
$deleted=[Collections.Generic.List[string]]::new()
$intentWritten=$false;$success=$false;$snapshot=$null
$script:cleanupStage='initial';$script:publicOrdinal=0

function Assert-RemainingOrdinaryPath([string]$Path,[switch]$Directory) {
  $full=[IO.Path]::GetFullPath($Path);$cursor=$full
  while($null -ne $cursor){
    $attributes=[IO.File]::GetAttributes($cursor)
    if(($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    if($cursor -ne $full -and ($attributes -band [IO.FileAttributes]::Directory) -eq 0){throw 'blocked'}
    $parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}
  }
  $isDirectory=([IO.File]::GetAttributes($full) -band [IO.FileAttributes]::Directory) -ne 0
  if($isDirectory -ne [bool]$Directory){throw 'blocked'}
  return $full
}
function Assert-RemainingAbsent([string]$Path) {
  $null=Assert-RemainingOrdinaryPath ([IO.Path]::GetDirectoryName($Path)) -Directory
  try{$null=[IO.File]::GetAttributes($Path)}catch [IO.FileNotFoundException]{return}
  throw 'blocked'
}
function Assert-RemainingKeys($Value,[string[]]$Keys) {
  if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($Keys|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}
}
function Read-RemainingPublic([string]$Relative,[string]$ExpectedHash) {
  $script:publicOrdinal++;if($script:publicOrdinal -gt 23){throw 'blocked'}
  $script:cleanupStage='public_pin_'+$script:publicOrdinal.ToString('00')
  if([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|[/\\])\.\.(?:[/\\]|$)|[:\x00]'){throw 'blocked'}
  $path=[IO.Path]::GetFullPath((Join-Path $repo $Relative))
  if(-not $path.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase) -or $ExpectedHash -cnotmatch '^[a-f0-9]{64}$'){throw 'blocked'}
  $null=Assert-RemainingOrdinaryPath $path
  $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $publicStreams.Add($stream)
  if($stream.Length -gt 2097152){throw 'blocked'} # Public artifacts only; never a temporary credential.
  $algorithm=[Security.Cryptography.SHA256]::Create()
  try{$actual=([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
  if($actual -cne $ExpectedHash){throw 'blocked'}
  $stream.Position=0;$reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8,$true,1024,$true)
  try{return $reader.ReadToEnd()}finally{$reader.Dispose()}
}
function Assert-RemainingPublicState {
  $checkpoint=ConvertFrom-Json -InputObject (Read-RemainingPublic 'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-checkpoint-20261022.json' '2954a33504376de123c2ca1638b11f3356d94fd274d35a7f62591642da463404')
  $null=Read-RemainingPublic 'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-attempt-20261022.json' '60b1bc756fb57cfba27e44cac6444dd7882327dc3ec3d4f6c1e0b2f803229fe3'
  $null=Read-RemainingPublic 'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-approval-20261022.json' 'cbc097a5ab606cf176a384084c66692b37b16b689676424211da19fc387f0b23'
  $null=Read-RemainingPublic 'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-packet-20261022.md' '7c4b9f3c3bb473a2ff4a473e23de79ce3b2c9a783cab5587d9caf9356d804205'
  $admission=ConvertFrom-Json -InputObject (Read-RemainingPublic ('scripts/n8n/out/foundation/live/remaining-continuation-'+$segment+'.json') 'c9745b21c0b9cfb6e648e23a40cd8dbb93c03d7d5bce4c245a362acee12ff4e7')
  $claim=ConvertFrom-Json -InputObject (Read-RemainingPublic ('scripts/n8n/out/foundation/live/remaining-continuation-'+$segment+'.runtime-claim.json') '81d12836e721c3bb98853ff0a238c49e556f933b0094b0d11a032c7f4dcf15a6')
  if($admission.parentProcessId -ne 5468 -or $admission.startsAt -ne 1792624345721 -or $claim.processId -ne 35920 -or $claim.parentProcessId -ne 5468 -or $claim.claimedAt -ne 1792624346581){throw 'blocked'}
  if(@($checkpoint.preserved.PSObject.Properties).Count -ne 14){throw 'blocked'}
  foreach($pin in $checkpoint.preserved.PSObject.Properties){$null=Read-RemainingPublic $pin.Name $pin.Value}
  $null=Read-RemainingPublic 'scripts/n8n/out/foundation/live/management.jsonl' '3d47a19f2481c5e7663c8d0624394fb36c3bc158394bb57bb1c5bc1f2089bcbd'
  $null=Read-RemainingPublic 'scripts/n8n/out/foundation/live/control.jsonl' 'c69bef7f046d8f0a67a368b07b8cd063a6552ed6883bd530d68c817b8f890d49'
  $null=Read-RemainingPublic 'scripts/n8n/out/foundation/live/setup.jsonl' '4dec713080ced4f0a752e559202e2090cf69fb33cf2c1e3fa180e8549229daf6'
  $script:cleanupStage='public_effect_absence'
  foreach($name in @('runtime.jsonl','preflight.jsonl')){Assert-RemainingAbsent (Join-Path $live $name)}
  $out=Join-Path $repo 'scripts/db/out';$null=Assert-RemainingOrdinaryPath $out -Directory
  if(@([IO.Directory]::GetFileSystemEntries($out,('m03-foundation-remaining-continuation-'+$segment+'-*'))).Count -ne 0){throw 'blocked'}
  foreach($name in @('m03-foundation-owner-provision-attempt.json','m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json')){Assert-RemainingAbsent (Join-Path $out $name)}
}
function Assert-RemainingProcessSnapshot($Rows) {
  $script:cleanupStage='process_shape'
  $values=@($Rows);if($values.Count -lt 1 -or $values.Count -gt 65536){throw 'blocked'}
  $seen=[Collections.Generic.HashSet[long]]::new();$parents=@{};$created=@{}
  foreach($row in $values){
    $script:cleanupStage='process_properties'
    if($row.ProcessId -isnot [uint32] -and $row.ProcessId -isnot [long] -and $row.ProcessId -isnot [int]){throw 'blocked'}
    if($row.ParentProcessId -isnot [uint32] -and $row.ParentProcessId -isnot [long] -and $row.ParentProcessId -isnot [int]){throw 'blocked'}
    $number=[long]$row.ProcessId;$parent=[long]$row.ParentProcessId
    if($number -lt 0 -or $parent -lt 0 -or -not $seen.Add($number)){throw 'blocked'}
    if($number -eq 0){if($parent -ne 0){throw 'blocked'}}
    elseif($row.CreationDate -isnot [DateTime]){$script:cleanupStage='process_creation';throw 'blocked'}
    if($row.CreationDate -is [DateTime] -and $row.CreationDate.ToUniversalTime() -gt [DateTime]::UtcNow.AddSeconds(1)){throw 'blocked'}
    $parents[$number]=$parent
    $created[$number]=if($row.CreationDate -is [DateTime]){$row.CreationDate.ToUniversalTime()}else{$null}
  }
  $script:cleanupStage='process_root_absence'
  foreach($number in @(5468L,35920L)){if($seen.Contains($number)){throw 'blocked'}}
  $script:cleanupStage='process_ancestry'
  foreach($number in $parents.Keys){
    $chain=[Collections.Generic.HashSet[long]]::new();$cursor=[long]$number
    while($parents.ContainsKey($cursor)){
      if($cursor -eq 0){break}
      if(-not $chain.Add($cursor)){throw 'blocked'}
      $parent=[long]$parents[$cursor]
      if($parent -in @(5468L,35920L)){throw 'blocked'}
      if($parent -eq 0 -or -not $parents.ContainsKey($parent)){break}
      # ParentProcessId survives its original process. A newer process with
      # that recycled PID is not this child's parent; never follow that edge.
      if($created[$parent] -gt $created[$cursor]){break}
      $cursor=$parent
    }
  }
  return $true
}
function Read-RemainingProcessSnapshot {
  # Never request CommandLine, ExecutablePath, environment or credentials.
  $script:cleanupStage='process_query'
  $rows=@(CimCmdlets\Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop)
  $null=Assert-RemainingProcessSnapshot $rows
  return @($rows|ForEach-Object{[ordered]@{processId=[long]$_.ProcessId;parentProcessId=[long]$_.ParentProcessId;createdAtUtc=$(if($_.CreationDate -is [DateTime]){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null})}})
}
function Get-RemainingCleanupTargets([string]$Temp,[string]$Runtime) {
  $targets=[Collections.Generic.List[object]]::new()
  foreach($kind in @('management','writer','apifyread')){
    foreach($suffix in @('.dpapi','.lease.json')){$targets.Add([pscustomobject]@{name=('emr-m03-acceptance-'+$kind+$suffix);path=(Join-Path $Temp ('emr-m03-acceptance-'+$kind+$suffix));kind=$kind;public=($suffix -ceq '.lease.json')})}
  }
  foreach($entry in @(@('emr-m03-acceptance-protection-bypass.dpapi','bypass',$false),@('emr-m03-acceptance-parent.operation.lock','parent',$true))){$targets.Add([pscustomobject]@{name=$entry[0];path=(Join-Path $Temp $entry[0]);kind=$entry[1];public=$entry[2]})}
  $targets.Add([pscustomobject]@{name='runtime.operation.lock';path=(Join-Path $Runtime 'runtime.operation.lock');kind='runtime';public=$true})
  if($targets.Count -ne 9 -or @($targets|Where-Object{$_.path -ne [IO.Path]::GetFullPath($_.path)}).Count -ne 0){throw 'blocked'}
  return $targets.ToArray()
}
function Initialize-RemainingNative {
  if('EmrM03RemainingCleanupNative' -as [type]){throw 'blocked'}
  # Reflection.Emit creates P/Invoke declarations in memory; no compiler child.
  $assembly=[AppDomain]::CurrentDomain.DefineDynamicAssembly([Reflection.AssemblyName]::new('EmrM03RemainingCleanupNative'),[Reflection.Emit.AssemblyBuilderAccess]::Run)
  $builder=$assembly.DefineDynamicModule('native').DefineType('EmrM03RemainingCleanupNative',[Reflection.TypeAttributes]'Public,Sealed,Abstract')
  foreach($method in @(
    @('CreateFileW',[IntPtr],[Type[]]@([string],[uint32],[uint32],[IntPtr],[uint32],[uint32],[IntPtr])),
    @('GetFinalPathNameByHandleW',[uint32],[Type[]]@([IntPtr],[Text.StringBuilder],[uint32],[uint32])),
    @('GetFileInformationByHandleEx',[int],[Type[]]@([IntPtr],[int],[IntPtr],[uint32])),
    @('SetFileInformationByHandle',[int],[Type[]]@([IntPtr],[int],[IntPtr],[uint32])),
    @('CloseHandle',[int],[Type[]]@([IntPtr]))
  )){
    $value=$builder.DefinePInvokeMethod($method[0],'kernel32.dll',$method[0],[Reflection.MethodAttributes]'Public,Static,PinvokeImpl',[Reflection.CallingConventions]::Standard,$method[1],$method[2],[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode)
    $value.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
  }
  $null=$builder.CreateType()
}
function Open-RemainingLeaf($Target,[ValidateRange(1,9)][int]$Ordinal=1) {
  $prefix='target_'+$Ordinal.ToString('00')+'_'
  $script:cleanupStage=$prefix+'physical'
  $path=Assert-RemainingOrdinaryPath $Target.path
  # DELETE + FILE_READ_ATTRIBUTES. Only explicitly public leases/locks add READ_DATA.
  $access=[uint32]65664;if($Target.public){$access=[uint32]2147549312}
  $script:cleanupStage=$prefix+'open'
  $handle=[EmrM03RemainingCleanupNative]::CreateFileW($path,$access,0,[IntPtr]::Zero,3,0x00200000,[IntPtr]::Zero)
  if($handle -eq [IntPtr]::new(-1)){throw 'blocked'}
  try{
    $script:cleanupStage=$prefix+'final_path'
    $buffer=[Text.StringBuilder]::new(32768);$length=[EmrM03RemainingCleanupNative]::GetFinalPathNameByHandleW($handle,$buffer,32768,0)
    if($length -eq 0 -or $length -ge 32768 -or $buffer.ToString() -cnotmatch '^\\\\\?\\'){throw 'blocked'}
    if(-not [string]::Equals($buffer.ToString().Substring(4),$path,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
    $memory=[Runtime.InteropServices.Marshal]::AllocHGlobal(40)
    try{
      $script:cleanupStage=$prefix+'timestamps'
      # FileBasicInfo contains timestamps and attributes, never a file size.
      if([EmrM03RemainingCleanupNative]::GetFileInformationByHandleEx($handle,0,$memory,40) -eq 0){throw 'blocked'}
      $attributes=[Runtime.InteropServices.Marshal]::ReadInt32($memory,32)
      if(($attributes -band 0x410) -ne 0){throw 'blocked'}
      $created=([DateTimeOffset][DateTime]::FromFileTimeUtc([Runtime.InteropServices.Marshal]::ReadInt64($memory,0))).ToUnixTimeMilliseconds()
      $written=([DateTimeOffset][DateTime]::FromFileTimeUtc([Runtime.InteropServices.Marshal]::ReadInt64($memory,16))).ToUnixTimeMilliseconds()
      if($created -lt 1792621645721 -or $written -lt $created -or $written -gt 1792624517956){throw 'blocked'}
    }finally{[Runtime.InteropServices.Marshal]::FreeHGlobal($memory)}
    if($Target.public){
      $script:cleanupStage=$prefix+'public_read'
      $safe=[Microsoft.Win32.SafeHandles.SafeFileHandle]::new($handle,$false)
      $stream=[IO.FileStream]::new($safe,[IO.FileAccess]::Read)
      try{if($stream.Length -gt 16384){throw 'blocked'};$reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8,$true,1024,$true);try{$text=$reader.ReadToEnd()}finally{$reader.Dispose()}}finally{$stream.Dispose();$safe.Dispose()}
      if($Target.kind -ceq 'runtime'){if($text -cne "emr-m03-foundation-live-runtime-v1`n"){throw 'blocked'}}
      elseif($Target.kind -ceq 'parent'){
        $script:cleanupStage=$prefix+'owner'
        $value=ConvertFrom-Json -InputObject $text;Assert-RemainingKeys $value @('kind','version','segmentId','processId')
        if($value.kind -cne 'm03_clock_admission_parent' -or $value.version -ne 1 -or $value.segmentId -cne $segment -or $value.processId -ne 5468){throw 'blocked'}
      }else{
        $script:cleanupStage=$prefix+'owner'
        $value=ConvertFrom-Json -InputObject $text;Assert-RemainingKeys $value @('version','windowId','purpose','approvedHead','approvedPacketSha256','kind','createdAt','expiresAt')
        if($value.version -ne 1 -or $value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $value.purpose -cne ('m03_approved_dev_acceptance_'+$Target.kind) -or $value.kind.ToLowerInvariant() -cne $Target.kind -or $value.approvedHead -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $value.approvedPacketSha256 -cne '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712'){throw 'blocked'}
        $script:cleanupStage=$prefix+'lease_time'
        $made=[DateTimeOffset]::Parse($value.createdAt,[Globalization.CultureInfo]::InvariantCulture);$expires=[DateTimeOffset]::Parse($value.expiresAt,[Globalization.CultureInfo]::InvariantCulture)
        if($made.ToUnixTimeMilliseconds() -lt 1792621645721 -or $made.ToUnixTimeMilliseconds() -gt 1792624345721 -or $expires -ne $made.AddHours(2)){throw 'blocked'}
      }
    }
    return [pscustomobject]@{name=$Target.name;path=$path;handle=$handle}
  }catch{$null=[EmrM03RemainingCleanupNative]::CloseHandle($handle);throw 'blocked'}
}
function Write-RemainingNewPublic([string]$Path,$Value) {
  Assert-RemainingAbsent $Path
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 12 -Compress)+"`n")
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Remove-RemainingHeldLeaf($Leaf) {
  $memory=[Runtime.InteropServices.Marshal]::AllocHGlobal(4)
  try{
    [Runtime.InteropServices.Marshal]::WriteInt32($memory,1)
    if([EmrM03RemainingCleanupNative]::SetFileInformationByHandle($Leaf.handle,4,$memory,4) -eq 0){throw 'blocked'}
  }finally{[Runtime.InteropServices.Marshal]::FreeHGlobal($memory)}
  if([EmrM03RemainingCleanupNative]::CloseHandle($Leaf.handle) -eq 0){throw 'blocked'}
  $Leaf.handle=[IntPtr]::Zero
  Assert-RemainingAbsent $Leaf.path
}

try{
  $script:cleanupStage='platform'
  if($env:OS -cne 'Windows_NT'){throw 'blocked'}
  $script:cleanupStage='local_identity'
  $local=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  if([string]::IsNullOrWhiteSpace($local) -or -not [string]::Equals([IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\'),[IO.Path]::GetFullPath($local).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $script:cleanupStage='directories'
  $temp=Assert-RemainingOrdinaryPath (Join-Path $local 'Temp') -Directory
  $null=Assert-RemainingOrdinaryPath $live -Directory
  $script:cleanupStage='one_use_fence'
  Assert-RemainingAbsent $intentPath;Assert-RemainingAbsent $resultPath
  Assert-RemainingPublicState
  $snapshot=@(Read-RemainingProcessSnapshot)
  $script:cleanupStage='admin_presence'
  foreach($suffix in @('.dpapi','.lease.json')){$null=Assert-RemainingOrdinaryPath (Join-Path $temp ('emr-m03-foundation-dev-migration-password'+$suffix))}
  $script:cleanupStage='native_init'
  Initialize-RemainingNative
  $script:cleanupStage='target_names';$ordinal=0
  foreach($target in @(Get-RemainingCleanupTargets $temp $live)){$ordinal++;$handles.Add((Open-RemainingLeaf $target $ordinal))}
  $snapshot=@(Read-RemainingProcessSnapshot)
  if($Mode -ceq 'Apply'){
    $script:cleanupStage='intent_write'
    Write-RemainingNewPublic $intentPath ([ordered]@{kind='m03_remaining_exact_temporary_cleanup_intent';version=1;segmentId=$segment;createdAtUtc=[DateTime]::UtcNow.ToString('o');targets=@($handles|ForEach-Object{$_.name});projectedProcessSnapshot=$snapshot;privateContentsRead=$false;networkRequests=0;childProcessesStarted=0;unknownOrphanClosureProven=$false})
    $intentWritten=$true
    foreach($leaf in $handles){$snapshot=@(Read-RemainingProcessSnapshot);$script:cleanupStage='delete_'+($deleted.Count+1).ToString('00');Remove-RemainingHeldLeaf $leaf;$deleted.Add($leaf.name)}
    $script:cleanupStage='admin_preservation'
    foreach($suffix in @('.dpapi','.lease.json')){$null=Assert-RemainingOrdinaryPath (Join-Path $temp ('emr-m03-foundation-dev-migration-password'+$suffix))}
  }
  $success=$true
}catch{
  # No native errors, contents, paths, process names or diagnostics are emitted.
}finally{
  foreach($leaf in $handles){if($leaf.handle -ne [IntPtr]::Zero){$null=[EmrM03RemainingCleanupNative]::CloseHandle($leaf.handle);$leaf.handle=[IntPtr]::Zero}}
  foreach($stream in $publicStreams){$stream.Dispose()}
  if($intentWritten){
    try{Write-RemainingNewPublic $resultPath ([ordered]@{kind='m03_remaining_exact_temporary_cleanup_result';version=1;segmentId=$segment;status=$(if($success){'exact_nine_leaves_removed'}else{'cleanup_partial_or_blocked'});deleted=@($deleted);observedAtUtc=[DateTime]::UtcNow.ToString('o');privateContentsRead=$false;networkRequests=0;childProcessesStarted=0;adminPairPreserved=$true;machineAndAdmissionsPreserved=$true;unknownOrphanClosureProven=$false;fullD=$false})}catch{$success=$false}
  }
}
if(-not $success){[ordered]@{status='M03_REMAINING_TEMPORARY_CLEANUP_BLOCKED';stage=$script:cleanupStage;privateContentsRead=$false;networkRequests=0}|ConvertTo-Json -Compress;exit 1}
[ordered]@{status=$(if($Mode -ceq 'CheckOnly'){'M03_REMAINING_TEMPORARY_CLEANUP_READY'}else{'M03_REMAINING_TEMPORARY_CLEANUP_VERIFIED'});targets=9;deleted=$deleted.Count;adminPairPreserved=$true;privateContentsRead=$false;networkRequests=0;childProcessesStarted=0;unknownOrphanClosureProven=$false;fullD=$false}|ConvertTo-Json -Compress
exit 0
