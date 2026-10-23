[CmdletBinding()]
param([ValidateSet('Shells','Reconcile','All','RestoreWF00','ProtectWf00Backup')][string]$Mode='All',[switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
function Safe-File([string]$Root,[string]$Relative){
 $file=[IO.Path]::GetFullPath((Join-Path $Root $Relative));if(-not $file.StartsWith($Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
 $cursor=$file
 while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
 return $file
}
try{
 $sealFile=Safe-File $repo 'scripts/n8n/foundation-provision-seal.json'
 if((Get-Item -LiteralPath $sealFile).Length -gt 262144){throw 'blocked'}
 $seal=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($sealFile))
 $moduleName='scripts/n8n/windows/Foundation-PublicRuntime.ps1'
 $module=Safe-File $repo $moduleName
 if($seal.files -isnot [PSCustomObject] -or $seal.files.PSObject.Properties[$moduleName].Value -isnot [string] -or $seal.files.PSObject.Properties[$moduleName].Value -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $module -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.files.PSObject.Properties[$moduleName].Value){throw 'blocked'}
 . $module
 $selectedNode=(Get-Command node.exe -CommandType Application).Source
 $node=Assert-M03FoundationPublicRuntimeSeal -RepositoryRoot $repo -Seal $seal -SelectedNodeExecutable $selectedNode
 $runner=Safe-File $repo 'scripts/n8n/foundation-provision-cli.mjs'
 $publicPacket=$null
 if($null -ne $seal.packetSha256){
  if($seal.packetSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'blocked'}
  $packetFile=Safe-File $repo 'scripts/n8n/foundation-delivery-packet.json';if((Get-Item -LiteralPath $packetFile).Length -gt 4096 -or (Get-FileHash -LiteralPath $packetFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.packetSha256){throw 'blocked'}
  $publicPacket=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($packetFile))
  if(@(Compare-Object -CaseSensitive @('version','windowId','audience','sourceCommitSha','deploymentId','environment','activationAuthorized'|Sort-Object) @($publicPacket.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $publicPacket.version -isnot [int] -or $publicPacket.version -ne 1 -or $publicPacket.windowId -isnot [string] -or $publicPacket.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $publicPacket.environment -isnot [string] -or $publicPacket.environment -cne 'preview' -or $publicPacket.activationAuthorized -isnot [bool] -or $publicPacket.activationAuthorized -ne $false -or $publicPacket.audience -isnot [string] -or $publicPacket.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $publicPacket.sourceCommitSha -isnot [string] -or $publicPacket.sourceCommitSha -cnotmatch '^[a-f0-9]{40}$' -or $publicPacket.deploymentId -isnot [string] -or $publicPacket.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{1,100}$'){throw 'blocked'}
 }
 if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){
  $targetFile=Safe-File $repo 'n8n/fixtures/WF-00-reviewed-native-staging-025c2a2.json';$approvalFile=Safe-File $repo 'milestones/M03-n8n-foundation/evidence/wf00-restore-approval-20261023.json';$attemptFile=Safe-File $repo 'milestones/M03-n8n-foundation/evidence/wf00-restore-attempt-20261023.json'
  foreach($publicFile in @($targetFile,$approvalFile,$attemptFile)){$entry=Get-Item -LiteralPath $publicFile -Force;if($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink'){throw 'blocked'}}
  if((Get-Item -LiteralPath $targetFile).Length -gt 262144 -or (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne '905e40aa96bea9291961f8e73297a8668b76ead397c834dbc7dc796e14ecfea9' -or (Get-Item -LiteralPath $approvalFile).Length -gt 8192 -or (Get-FileHash -LiteralPath $approvalFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne '2fe70820c5aec160d77e1ae64e5160f8faacdfb055cf7258bc0f6308926a197e'){throw 'blocked'}
  $approval=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($approvalFile))
  if($approval.workflowId -cne 'MzimjpsuyPuK7SKe' -or $approval.projectId -cne 'pHvQjDmjxVZ3KQLT' -or $approval.sourceCommitSha -cne '025c2a2c0127566df71cef77797db277f1565568' -or $approval.sourceFile -cne 'n8n/workflows/WF-00.json' -or $approval.ownerReply -cne 'Restore reviewed WF-00 (Recommended)'){throw 'blocked'}
  foreach($name in @('privateEncryptedRollbackRequired','freshDriftRecheckRequired','savedGraphReadbackRequired')){if($approval.$name -isnot [bool] -or $approval.$name -ne $true){throw 'blocked'}}
  foreach($name in @('otherWorkflowMutationAllowed','executionAllowed','productionAllowed','budgetReplenished')){if($approval.$name -isnot [bool] -or $approval.$name -ne $false){throw 'blocked'}}
  if((Get-Item -LiteralPath $attemptFile).Length -gt 16384 -or (Get-FileHash -LiteralPath $attemptFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'e5d6188f80281a0603209b57de131f4f8fe16278c7d56a53ae3f56b77156a3f7'){throw 'blocked'}
  $attempt=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($attemptFile))
  if($attempt.kind -cne 'actual_owned_wf00_restore_attempt' -or $attempt.toolReceipt -cne '905f06' -or $attempt.environment -cne 'dev' -or $attempt.host -cne 'muhhammedsayed.app.n8n.cloud' -or $attempt.projectId -cne 'pHvQjDmjxVZ3KQLT' -or $attempt.workflowId -cne 'MzimjpsuyPuK7SKe' -or $attempt.actual.nativeExit -isnot [int] -or $attempt.actual.nativeExit -ne 1 -or $attempt.actual.requestCount -isnot [int] -or $attempt.actual.requestCount -ne 1 -or $attempt.actual.getCount -ne 1 -or $attempt.actual.putCount -ne 0 -or $attempt.actual.backupRunId -cne 'fc0bdea1-f733-4c68-ba8c-f062e83b7919' -or $attempt.journal.rowCount -ne 2 -or $attempt.journal.sha256 -cne '22c18ac86b7e0e03762cf19ad98a33560344af664fcf25f0a45673906fdc955d'){throw 'blocked'}
  foreach($name in @('backupReady','networkCompletionVerified','childClosed','parentLockDeleted','persistentManagementRetained')){if($attempt.actual.$name -isnot [bool] -or $attempt.actual.$name -ne $true){throw 'blocked'}}
  foreach($name in @('writeIntentRecorded','putAttempted','restored')){if($attempt.actual.$name -isnot [bool] -or $attempt.actual.$name -ne $false){throw 'blocked'}}
  if($Mode -ceq 'RestoreWF00'){
   $priorJournal=Safe-File $repo 'scripts/n8n/out/foundation/wf00-restore-20261023.jsonl';$entry=Get-Item -LiteralPath $priorJournal -Force
   if($entry.Length -gt 65536 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (Get-FileHash -LiteralPath $priorJournal -Algorithm SHA256).Hash.ToLowerInvariant() -cne '22c18ac86b7e0e03762cf19ad98a33560344af664fcf25f0a45673906fdc955d'){throw 'blocked'}
  }
 }
}catch{Write-Output 'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.';exit 1}
if($CheckOnly){
 [ordered]@{status='foundation_public_seal_ready';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0;maximumRequests=$(if($Mode -ceq 'RestoreWF00'){3}elseif($Mode -ceq 'ProtectWf00Backup'){0}else{185});maximumShellCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{25});maximumTagCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{13});maximumCredentialCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{1});finalBindingReady=($null -ne $publicPacket)}|ConvertTo-Json -Compress
 exit 0
}
function Read-M03Wf00PrivateInput {
 [Console]::InputEncoding=[Text.UTF8Encoding]::new($false,$true)
 $characters=New-Object char[] 4096;$builder=[Text.StringBuilder]::new()
 try{while(($count=[Console]::In.Read($characters,0,$characters.Length)) -gt 0){if($builder.Length+$count -gt 1048576){throw 'blocked'};$null=$builder.Append($characters,0,$count)};return ConvertFrom-Json -InputObject $builder.ToString() -ErrorAction Stop}
 finally{[Array]::Clear($characters,0,$characters.Length);$builder.Clear()|Out-Null}
}
function Assert-M03Wf00RestoreParent {
 $path=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
 $entry=Assert-M03DevPlainPath $path $false;if($entry.Length -gt 1024){throw 'blocked'}
 $stream=$null;$reader=$null;$probe=$null
 try{
  $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);$reader=[IO.StreamReader]::new($stream)
  $owner=ConvertFrom-Json -InputObject ($reader.ReadToEnd()) -ErrorAction Stop
  Assert-M03FoundationObjectKeys $owner @('kind','version','processId')
  if($owner.kind -cne 'm03_wf00_restore_parent' -or $owner.version -isnot [int] -or $owner.version -ne 1 -or $owner.processId -isnot [int] -or $owner.processId -le 0){throw 'blocked'}
  $null=Get-Process -Id $owner.processId -ErrorAction Stop
  $locked=$false
  try{$probe=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)}catch [IO.IOException]{$locked=$true}
  if(-not $locked){throw 'blocked'}
 }finally{if($null -ne $probe){$probe.Dispose()};if($null -ne $reader){$reader.Dispose()}elseif($null -ne $stream){$stream.Dispose()}}
}
if($Mode -ceq 'ProtectWf00Backup'){
 $dto=$null;$backup=$null;$plain=$null;$encrypted=$null;$serialized=$null;$exitCode=1
 try{
  . (Safe-File $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
  Assert-M03Wf00RestoreParent
  $backup=Read-M03Wf00PrivateInput
  Assert-M03FoundationObjectKeys $backup @('kind','runId','dto')
  if($backup.kind -cne 'wf00_restore_backup' -or $backup.runId -isnot [string] -or $backup.runId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' -or $backup.dto -isnot [PSCustomObject]){throw 'blocked'}
  $dto=$backup.dto
  $expectedName='WF-00 '+[char]0x00b7+' Orchestrator [dev]'
  if($dto.id -isnot [string] -or $dto.id -cne 'MzimjpsuyPuK7SKe' -or $dto.name -isnot [string] -or $dto.name -cne $expectedName -or $dto.active -isnot [bool] -or $dto.active -ne $false -or $null -eq $dto.PSObject.Properties['activeVersionId'] -or $null -ne $dto.activeVersionId -or $dto.isArchived -isnot [bool] -or $dto.isArchived -ne $false -or $dto.versionId -isnot [string] -or $dto.versionId -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $dto.nodes -isnot [array] -or $dto.nodes.Count -gt 256 -or $dto.connections -isnot [PSCustomObject] -or $dto.settings -isnot [PSCustomObject] -or $dto.shared -isnot [array] -or $dto.shared.Count -ne 1 -or $dto.shared[0].projectId -cne 'pHvQjDmjxVZ3KQLT' -or $dto.shared[0].role -cne 'workflow:owner'){throw 'blocked'}
  if($null -ne $dto.PSObject.Properties['activeVersion'] -and $null -ne $dto.activeVersion){throw 'blocked'}
  $cursor=(Assert-M03DevPlainPath $env:LOCALAPPDATA $true).FullName
  foreach($part in @('Everyone-Market-Radar-Private','foundation','wf00-restore')){$cursor=Join-Path $cursor $part;if(-not (Test-Path -LiteralPath $cursor)){[IO.Directory]::CreateDirectory($cursor)|Out-Null;if($part -ceq 'wf00-restore'){Set-M03DevPrivateAcl $cursor $true}};$null=Assert-M03DevPlainPath $cursor $true}
  Assert-M03DevPrivateAcl $cursor $true
  $serialized=ConvertTo-Json -InputObject $dto -Depth 100 -Compress
  $plain=[Text.UTF8Encoding]::new($false).GetBytes($serialized);if($plain.Length -gt 1048576){throw 'blocked'}
  Add-Type -AssemblyName System.Security
  $encrypted=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  Write-M03DevPrivateFile -Path (Join-Path $cursor ($backup.runId+'.dpapi')) -Bytes $encrypted
  [ordered]@{kind='wf00_restore_backup_ready';runId=$backup.runId;backupReady=$true;childNoCredential=$true}|ConvertTo-Json -Compress
  $exitCode=0
 }catch{Write-Output 'M03_WF00_BACKUP_BLOCKED'}finally{if($null -ne $plain){[Array]::Clear($plain,0,$plain.Length)};if($null -ne $encrypted){[Array]::Clear($encrypted,0,$encrypted.Length)};$dto=$null;$backup=$null;$serialized=$null}
 exit $exitCode
}
if($Mode -ceq 'RestoreWF00'){
 $key=$null;$secret=$null;$cipher=$null;$child=$null;$start=$null;$memory=$null;$buffer=$null;$text=$null;$result=$null;$packet=$null;$operationLock=$null;$parentLock=$null;$parentPath=$null;$source=$null;$started=$false;$closed=$true;$forcedStop=$false;$bstr=[IntPtr]::Zero;$exitCode=1
 $receipt=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';host='muhhammedsayed.app.n8n.cloud';projectId='pHvQjDmjxVZ3KQLT';workflowId='MzimjpsuyPuK7SKe';status='wf00_restore_blocked';requestCount=0;backupReady=$false;writeIntentRecorded=$false;putAttempted=$false;putAcknowledged=$false;exactContentVerified=$false;inactiveVerified=$false;ownerAndTagsVerified=$false;versionId=$null;beforeVersionPrivatelyBackedUp=$false;nativeStorageModePreserved=$false;executionCount=0;credentialsCreated=0;gatewayWindowStarted=$false;networkCompletionVerified=$false;diagnostic=$null;nativeExit=$null;childClosed=$true;operationLockAcquired=$false;parentLockDeleted=$false;privateRead=$false;persistentManagementRetained=$false}
 try{
  . (Safe-File $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
  $outputDirectory=Join-Path $repo 'scripts/n8n/out/foundation'
  foreach($relative in @('scripts/n8n/out','scripts/n8n/out/foundation')){$directory=Join-Path $repo $relative;if(-not (Test-Path -LiteralPath $directory)){[IO.Directory]::CreateDirectory($directory)|Out-Null};$null=Safe-File $repo $relative}
  $operationPath=Join-Path $outputDirectory 'provision.lock';$existed=Test-Path -LiteralPath $operationPath
  if($existed){$null=Safe-File $repo 'scripts/n8n/out/foundation/provision.lock'}
  $operationLock=[IO.File]::Open($operationPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $marker=[Text.Encoding]::ASCII.GetBytes('M03_FOUNDATION_OPERATION_LOCK df4f29ec-e2dc-4d82-a276-62a4e695e6f9')
  if($existed){if($operationLock.Length -ne $marker.Length){throw 'blocked'};$actual=New-Object byte[] $marker.Length;if($operationLock.Read($actual,0,$actual.Length) -ne $actual.Length -or [Text.Encoding]::ASCII.GetString($actual) -cne [Text.Encoding]::ASCII.GetString($marker)){throw 'blocked'}}else{$operationLock.Write($marker,0,$marker.Length);$operationLock.Flush($true)}
  $null=Assert-M03DevPlainPath (Join-Path $env:LOCALAPPDATA 'Temp') $true
  $parentPath=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
  if(Test-Path -LiteralPath $parentPath){throw 'blocked'}
  $parentLock=[IO.File]::Open($parentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
  Set-M03DevPrivateAcl $parentPath $false
  $owner=[Text.UTF8Encoding]::new($false).GetBytes((([ordered]@{kind='m03_wf00_restore_parent';version=1;processId=$PID})|ConvertTo-Json -Compress));$parentLock.Write($owner,0,$owner.Length);$parentLock.Flush($true)
  $receipt.operationLockAcquired=$true
  $spec=Get-M03DevCredentialSpec -Kind Management;$source=$spec.Source
  Assert-M03DevPrivateAcl (Get-M03DevCredentialRoot) $true;Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($source)) $true;Assert-M03DevPrivateAcl $source $false
  $receipt.privateRead=$true;$cipher=[IO.File]::ReadAllBytes($source);Assert-M03DevCipherFraming $cipher
  $secret=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipher));[Array]::Clear($cipher,0,$cipher.Length);$cipher=$null
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);$key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secret.Dispose();$secret=$null
  if([string]::IsNullOrEmpty($key) -or $key.Length -gt 4096 -or $key -cmatch '[^\x21-\x7e]'){throw 'blocked'}
  $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node;$start.Arguments='"'+$runner+'" RestoreWF00';$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$value=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $value){$start.EnvironmentVariables[$name]=$value}}
  $child=[Diagnostics.Process]::new();$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$receipt.requestCount=$null;$start.EnvironmentVariables.Clear()
  $buffer=New-Object byte[] 8192;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $packet=[ordered]@{key=$key;expiresAt=[DateTimeOffset]::UtcNow.AddMinutes(5).ToString('o');purpose='m03_owned_wf00_restore';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
  $child.StandardInput.Write(($packet|ConvertTo-Json -Compress));$child.StandardInput.Close();$packet=$null
  if(-not $child.WaitForExit(300000)){$forcedStop=$true;throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode
  if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
  $text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);if($text.Contains($key)){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $text
  $keys=@('version','windowId','host','projectId','workflowId','status','requestCount','backupReady','writeIntentRecorded','putAttempted','putAcknowledged','exactContentVerified','inactiveVerified','ownerAndTagsVerified','versionId','beforeVersionPrivatelyBackedUp','nativeStorageModePreserved','executionCount','credentialsCreated','gatewayWindowStarted','networkCompletionVerified','diagnostic')
  Assert-M03FoundationObjectKeys $result $keys
  foreach($name in @('version','windowId','host','projectId','workflowId','executionCount','credentialsCreated','gatewayWindowStarted')){if($result.$name -cne $receipt[$name] -or $result.$name.GetType() -ne $receipt[$name].GetType()){throw 'blocked'}}
  if($result.status -isnot [string] -or $result.status -cnotin @('wf00_restore_verified','wf00_restore_reconciled','wf00_restore_blocked','wf00_restore_reconciliation_required') -or $result.requestCount -isnot [int] -or $result.requestCount -lt 0 -or $result.requestCount -gt 3){throw 'blocked'}
  foreach($name in @('backupReady','writeIntentRecorded','putAttempted','putAcknowledged','exactContentVerified','inactiveVerified','ownerAndTagsVerified','beforeVersionPrivatelyBackedUp','nativeStorageModePreserved','networkCompletionVerified')){if($result.$name -isnot [bool]){throw 'blocked'}}
  if(($null -ne $result.versionId -and ($result.versionId -isnot [string] -or $result.versionId -cnotmatch '^[A-Za-z0-9_-]{1,128}$')) -or ($null -ne $result.diagnostic -and ($result.diagnostic -isnot [string] -or $result.diagnostic -cnotin @('source_blocked','drift_blocked','backup_blocked','intent_recorded','transport_failed','readback_mismatch','completion_unverified','settings_merge_unsupported')))){throw 'blocked'}
  foreach($name in $keys){$receipt[$name]=$result.$name}
  if($result.status -cin @('wf00_restore_verified','wf00_restore_reconciled')){if($receipt.nativeExit -ne 0 -or $null -eq $result.versionId){throw 'blocked'};foreach($name in @('backupReady','writeIntentRecorded','putAttempted','exactContentVerified','inactiveVerified','ownerAndTagsVerified','beforeVersionPrivatelyBackedUp','nativeStorageModePreserved','networkCompletionVerified')){if($result.$name -ne $true){throw 'blocked'}};if(($result.status -ceq 'wf00_restore_verified' -and $result.putAcknowledged -ne $true) -or ($result.status -ceq 'wf00_restore_reconciled' -and $result.putAcknowledged -ne $false)){throw 'blocked'};$exitCode=0}
 }catch{$receipt.status='wf00_restore_blocked'}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $cipher){[Array]::Clear($cipher,0,$cipher.Length)};$key=$null;$packet=$null;$secret=$null;$text=$null;$result=$null
  if($null -ne $start){$start.EnvironmentVariables.Clear()}
  if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$forcedStop=$true;$child.Kill()};$closed=$child.WaitForExit(5000);if($closed){$receipt.nativeExit=$child.ExitCode}}catch{$closed=$false}};try{$child.Dispose()}catch{$closed=$false}}
  # A forced Node stop cannot prove an in-flight backup descendant has closed.
  # Retain the shared ownership marker instead of authorizing an unsafe retry.
  if($forcedStop){$closed=$false}
  if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  $receipt.childClosed=$closed;if(-not $closed){$exitCode=1}
  if($null -ne $source){$receipt.persistentManagementRetained=Test-Path -LiteralPath $source -PathType Leaf}
  if($null -ne $parentLock){$parentLock.Dispose();if($closed){try{[IO.File]::Delete($parentPath);$receipt.parentLockDeleted=-not (Test-Path -LiteralPath $parentPath)}catch{$exitCode=1}}}
  if($null -ne $operationLock){$operationLock.Dispose()}
 }
 $receipt|ConvertTo-Json -Compress
 exit $exitCode
}
$secret=$null;$key=$null;$machine=$null;$machineSecret=$null;$bstr=[IntPtr]::Zero;$child=$null;$start=$null;$memory=$null;$buffer=$null;$operationLock=$null;$closed=$true;$started=$false;$consumed=$false;$exitCode=1
$receipt=[ordered]@{version=1;status='blocked';nativeExit=$null;childClosed=$true;requestCount=0;verifiedWorkflows=0;handoffDeleted=$false;leaseDeleted=$false;finalBindingReady=$false;pendingMachineStoreRetained=$false;inactiveDefinitionsSaved=$false;deferredErrorWorkflowCount=0;persistedExports=0;errorRoutingAccepted=$false;operationLockAcquired=$false;privateRead=$false;diagnostics=$null}
try{
 if($Mode -ceq 'All' -and $null -eq $publicPacket){throw 'blocked'}
 $outputDirectory=Join-Path $repo 'scripts/n8n/out/foundation'
 foreach($relative in @('scripts/n8n/out','scripts/n8n/out/foundation')){$directory=Join-Path $repo $relative;if(-not (Test-Path -LiteralPath $directory)){[IO.Directory]::CreateDirectory($directory)|Out-Null};$null=Safe-File $repo $relative}
 $lockPath=Join-Path $outputDirectory 'provision.lock';$lockExisted=Test-Path -LiteralPath $lockPath
 if($lockExisted){$null=Safe-File $repo 'scripts/n8n/out/foundation/provision.lock'}
 $operationLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $marker=[Text.Encoding]::ASCII.GetBytes('M03_FOUNDATION_OPERATION_LOCK df4f29ec-e2dc-4d82-a276-62a4e695e6f9')
 if($lockExisted){if($operationLock.Length -ne $marker.Length){throw 'blocked'};$actualMarker=New-Object byte[] $marker.Length;if($operationLock.Read($actualMarker,0,$actualMarker.Length) -ne $actualMarker.Length -or [Text.Encoding]::ASCII.GetString($actualMarker) -cne [Text.Encoding]::ASCII.GetString($marker)){throw 'blocked'}}else{if($operationLock.Length -ne 0){throw 'blocked'};$operationLock.Write($marker,0,$marker.Length);$operationLock.Flush($true)}
 $receipt.operationLockAcquired=$true
 $privateRoot=[IO.Path]::GetFullPath($env:LOCALAPPDATA)
 $handoff=Safe-File $privateRoot 'Temp/emr-m03-foundation-management.dpapi'
 $leaseFile=Safe-File $privateRoot 'Temp/emr-m03-foundation-management.lease.json'
 if((Get-Item -LiteralPath $handoff).Length -gt 32768 -or (Get-Item -LiteralPath $leaseFile).Length -gt 4096){throw 'blocked'}
 $lease=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($leaseFile))
 if(@(Compare-Object -CaseSensitive @('version','windowId','purpose','createdAt','expiresAt'|Sort-Object) @($lease.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $lease.version -isnot [int] -or $lease.version -ne 1 -or $lease.windowId -isnot [string] -or $lease.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $lease.purpose -isnot [string] -or $lease.purpose -cne 'm03_owned_inactive_provision' -or $lease.createdAt -isnot [string] -or $lease.expiresAt -isnot [string]){throw 'blocked'}
 $created=[DateTimeOffset]::Parse($lease.createdAt);$expires=[DateTimeOffset]::Parse($lease.expiresAt);$now=[DateTimeOffset]::UtcNow
 if($created -gt $now -or $expires-$now -lt [TimeSpan]::FromMinutes(41) -or $expires-$created -ne [TimeSpan]::FromHours(2)){throw 'blocked'}
 $consumed=$true;$receipt.privateRead=$true;$secret=ConvertTo-SecureString -String ([IO.File]::ReadAllText($handoff).Trim())
 $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);$key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secret.Dispose();$secret=$null
 if([string]::IsNullOrEmpty($key) -or $key.Length -gt 4096 -or $key -cmatch '[^\x21-\x7e]'){throw 'blocked'}
 if($Mode -ceq 'All'){
  $pendingMachineFile=Join-Path $privateRoot 'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi'
  . (Safe-File $repo 'scripts/n8n/windows/Get-M03FoundationPendingMachine.ps1')
  $machineSecret=Get-M03FoundationPendingMachine -Audience $publicPacket.audience -SourceCommitSha $publicPacket.sourceCommitSha -BindingJournalPath (Safe-File $repo 'scripts/n8n/out/foundation/binding-intents.jsonl')
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($machineSecret);$machine=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$machineSecret.Dispose();$machineSecret=$null
  if($machine -cnotmatch '^[A-Za-z0-9_-]{43}$'){throw 'blocked'};$receipt.pendingMachineStoreRetained=$true
 }
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node;$start.Arguments='"'+$runner+'" '+$Mode;$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $start.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear()
 $buffer=New-Object byte[] 524288;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true)
 $stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
 $packet=[ordered]@{key=$key;expiresAt=$lease.expiresAt;purpose=$lease.purpose;windowId=$lease.windowId}
 if($Mode -ceq 'All'){$packet.machine=$machine}
 $child.StandardInput.Write(($packet|ConvertTo-Json -Compress));$child.StandardInput.Close();$packet=$null
 if(-not $child.WaitForExit(2400000)){throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode
 if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
 $text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);if($text.Contains($key) -or ($null -ne $machine -and $text.Contains($machine))){throw 'blocked'}
 $result=ConvertFrom-Json -InputObject $text
 if($result.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $result.host -cne 'muhhammedsayed.app.n8n.cloud' -or $result.projectId -cne 'pHvQjDmjxVZ3KQLT' -or $result.requestCount -lt 0 -or $result.requestCount -gt 185 -or $result.executionCount -ne 0 -or $result.credentialsCreated -lt 0 -or $result.credentialsCreated -gt 1 -or $result.gatewayWindowStarted -isnot [bool] -or $result.gatewayWindowStarted -ne $false -or $result.finalGraphsBound -isnot [bool] -or $result.inactiveDefinitionsSaved -isnot [bool] -or $result.deferredErrorWorkflowCount -isnot [int] -or $result.deferredErrorWorkflowCount -lt 0 -or $result.deferredErrorWorkflowCount -gt 24 -or $result.persistedExports -isnot [int] -or $result.persistedExports -lt 0 -or $result.persistedExports -gt 25 -or $result.errorRoutingAccepted -isnot [bool] -or $result.errorRoutingAccepted -ne $false -or $result.finalGraphsBound -ne $false){throw 'blocked'}
 if($Mode -ceq 'All' -and $result.status -ceq 'inactive_foundation_staged' -and ($result.verifiedWorkflows -isnot [int] -or $result.verifiedWorkflows -ne 25 -or $result.inactiveDefinitionsSaved -ne $true -or $result.deferredErrorWorkflowCount -ne 24 -or $result.persistedExports -ne 25 -or $result.finalGraphsBound -ne $false -or $result.errorRoutingAccepted -ne $false)){throw 'blocked'}
 $receipt.status=$result.status;$receipt.requestCount=$result.requestCount;$receipt.verifiedWorkflows=$result.verifiedWorkflows;$receipt.finalBindingReady=$result.finalGraphsBound;$receipt.inactiveDefinitionsSaved=$result.inactiveDefinitionsSaved;$receipt.deferredErrorWorkflowCount=$result.deferredErrorWorkflowCount;$receipt.errorRoutingAccepted=$result.errorRoutingAccepted;$receipt.persistedExports=$result.persistedExports
 $diagnosticProperty=$result.PSObject.Properties['diagnostics']
 if($null -ne $diagnosticProperty -and $null -ne $diagnosticProperty.Value){
  $d=$diagnosticProperty.Value
  if(@(Compare-Object -CaseSensitive @('lastMethod','lastResource','httpStatus','transportCode','transportReason'|Sort-Object) @($d.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $d.lastMethod -cnotin @('GET','POST','PUT') -or $d.lastResource -cnotin @('credential_schema','owned_credential','tags','projects','owned_workflows') -or ($null -ne $d.httpStatus -and ($d.httpStatus -isnot [int] -or $d.httpStatus -lt 100 -or $d.httpStatus -gt 599)) -or ($null -ne $d.transportCode -and ($d.transportCode -isnot [string] -or ($d.transportCode -cne 'unclassified' -and $d.transportCode -cnotmatch '^FOUNDATION_(?:TRANSPORT_(?:DNS|CLOSE|TLS|STATUS|BODY|PARSE|DEADLINE)|REQUEST_REJECTED)$'))) -or ($null -ne $d.transportReason -and ($d.transportReason -isnot [string] -or $d.transportReason -cnotin @('lease_expired','request_not_allowed','dns_rejected','socket_not_closed','response_incomplete','request_timeout','response_aborted','response_error','status_invalid','content_encoding_rejected','transfer_framing_rejected','content_length_invalid','body_declared_limit','body_stream_limit','body_incomplete','body_length_mismatch','utf8_invalid','json_invalid','duplicate_socket','socket_error','request_error','request_failed')))){throw 'blocked'}
  $receipt.diagnostics=$d
 }
 if($receipt.nativeExit -eq 0 -and $result.status -cin @('shells_verified','reconciliation_complete','inactive_foundation_staged')){$exitCode=0}
}catch{
 # No raw exceptions, child output, connection values or credentials escape.
}finally{
 if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $machineSecret){$machineSecret.Dispose()};$secret=$null;$machineSecret=$null;$machine=$null;$key=$null;$packet=$null;$text=$null;$result=$null
 if($null -ne $start){$start.EnvironmentVariables.Clear()}
 if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000);if($closed){$receipt.nativeExit=$child.ExitCode}}catch{$closed=$false}};try{$child.Dispose()}catch{$exitCode=1}}
 if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
 $receipt.childClosed=$closed
 if($consumed){try{[IO.File]::Delete($handoff);$receipt.handoffDeleted=-not (Test-Path -LiteralPath $handoff)}catch{};try{[IO.File]::Delete($leaseFile);$receipt.leaseDeleted=-not (Test-Path -LiteralPath $leaseFile)}catch{};if(-not $receipt.handoffDeleted -or -not $receipt.leaseDeleted){$exitCode=1}}
 if(-not $closed){$exitCode=1}
 if($Mode -ceq 'All' -and $null -ne (Get-Variable -Name pendingMachineFile -ErrorAction SilentlyContinue)){try{$receipt.pendingMachineStoreRetained=Test-Path -LiteralPath $pendingMachineFile -PathType Leaf}catch{}}
 if($null -ne $operationLock){$operationLock.Dispose()}
}
$receipt|ConvertTo-Json -Compress
exit $exitCode
