[CmdletBinding()]
param([ValidateSet('Shells','Reconcile','All','RestoreWF00','ProtectWf00Backup','RestoreTechnical13','CleanupTechnical16')][string]$Mode='All',[switch]$CheckOnly,[switch]$QualificationOnly,[switch]$CurrentWf00)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
function Safe-File([string]$Root,[string]$Relative){
 $file=[IO.Path]::GetFullPath((Join-Path $Root $Relative));if(-not $file.StartsWith($Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
 $cursor=$file
 while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
 return $file
}
function Move-M03Technical16StaleLock {
 $recordRelative='milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json'
 if(-not (Test-Path -LiteralPath (Join-Path $repo $recordRelative))){throw 'blocked'}
 $pins=[ordered]@{
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json'='4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json'='1e165ea75442200af05e57206c32cd0edc07c248571a1405ae8025e31588e66e'
  'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl'='4fccea19e19a162ca2d7b912c200a0cb1fc857b9ea54d4bdf5b6f97f76dd71d7'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json'='9aade5d3ae4c4a0a3aace8da74c38e3b0c9f1da672d7187c7ff1b14aeee9ca1b'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt2-20261024.json'='5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.json'='86e74f0c574384e33c28721b345899476d198d49e91501c3f37d8a27f9361639'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.jsonl'='bac9e865ea04c6f083dc836e2e71e0cd37a58dc542a5f03af7ed06767b66ee17'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2-result.json'='efa7b2812baf34f520eac9bea4337b5197bfc680244acaaabe6fcead8a55c137'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.provision-seal.json'='45a924660d94d87a5fc9eab45307c550a74288b6556873633c39b571c37b62be'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt3-20261024.json'='886da0004471f526d0767c3e60a5c1474bb38f439f022ab3edd162efdeb412ae'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.json'='6319abe719e5fb40d0e77e83376ef39a625c341e9195f055255b435029016a61'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.jsonl'='0e6c97a10ee2aca0c1171f09a63dcc4b536a8df58e3061cb804d7fac98ab6f27'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3-result.json'='5609476a03848f524398f3e72ca614d1a5e6390cc8b9e287ac1bc9ff95c972c5'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.provision-seal.json'='0e7051051f4e605b42da8da40261237f9682f492860d1c05ace19a5b79b90af5'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt4-20261024.json'='68fecd32ceda855b5f522bf9448f5fa94c1411dc4bd4950ea6d7a3979602bc72'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.json'='9c5a07ff9c23ebf14cabf96c245ec8fe4d0eeca4a2b13c2c50e918a90a84b7de'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.jsonl'='76d3b6b1fa4367e9a2ecfa79eab0fd4f2dbfd26402f8bd224a0945541aa7f62d'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4-result.json'='7c4f4923a985842d4286c603810449c08ec305a7a0c721a689b9e040cd739ebf'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.provision-seal.json'='41a6afc82524105adb2f522c78abc63a9e6dddcec4898969d11facefe193cab7'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt5-20261024.json'='7aa4ab07f9be3f837a49cbc69dbedc2c19720493740e05157ff852b9161ced55'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.json'='ab3ad645c29b1d21db2a1df3b9f5b968b8c0c6774a2f79a0eabeabf70ffa36bb'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.jsonl'='8c3e54a720e0d9488a7e8026c88c95103430d790d9cb5caecd71cbf018a2b970'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5-result.json'='199e4499e30e362a5a72048846e782dd08a25afb444bd43aaf9467ffeb38d02a'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.provision-seal.json'='968943a6f5de2322a48ab6cbfe514d6a80e750ea0356978448d82b843e50dfc3'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt6-20261024.json'='1bf2243210b417b8ea7d2ed360adc3c026796a57271c7488f664acc145673a7d'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.json'='2a814ff7c93f2734322796b1214c806cdd8580420933de52f44862024fb54927'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.jsonl'='59a30c4ec18a34c2c49773a61534e4e2149d4bdc73bf8fd45976b06eb7d801e4'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6-result.json'='85982e616aaac3b37654e70e4c562410e44449ed65944a6d93aacae4c369cc19'
  'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.provision-seal.json'='162ae09e991e6a18b8c6969663e0c9f71d1b7d7661ba7dc10ec1d41f9f8e7d22'
  'milestones/M03-n8n-foundation/evidence/technical16-public-transport-diagnostics-20261024.json'='6185e8af680ebd245a63b33e5fbd8390bd6804e71a994d9fe30db190016789bc'
  'scripts/n8n/out/foundation/technical16-public-transport-diagnostic-20261024.jsonl'='db7a307dff3cf2b357bdacdba093614f75a7d371f064ae630ca40f384693b797'
  'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024.jsonl'='693802c29a5ce12e3ca290e4c80ea3d0d0790394e24eb93e1629c3e9d7100767'
  'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024-result.json'='822d47f80da7e71ca512463d69fbf6f358f5d45a21a245cb2f8d00d0fcffd287'
  'scripts/n8n/out/foundation/technical16-public-tls-timing-20261024.json'='d33f411b5cf69f3b95bb96b0178b721946672530f05c3ec10a632b8b0b01dd2b'
  'milestones/M03-n8n-foundation/evidence/technical16-wf32-discovery-readback-20261024.json'='9a6463326e06719dc0a4123145df96f49ebcf9f4125be81f727f496f5f635c39'
  'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl'='54f2981b2d0faaa4b71793de2d5eaa59d22161657a449c4244ad3ceddbdb10f2'
  'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.inventory-seal.json'='985fb551e12a66e106c267a2fd43e4fb8a15194d76f50fd35d828c2474809cc4'
  'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.foundation-seal.json'='12575579756a116397b7e0249e7ed37d99398fe7fd211056ac2007b885b8387e'
 }
 foreach($relative in $pins.Keys){$path=Safe-File $repo $relative;$entry=Get-Item -LiteralPath $path -Force;if($entry.PSIsContainer -or $entry.Length -gt 262144 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pins[$relative]){throw 'blocked'}}
 $failed=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo $recordRelative)))
 $second=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt2-20261024.json')))
 $third=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt3-20261024.json')))
 $fourth=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt4-20261024.json')))
 $fifth=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt5-20261024.json')))
 $sixth=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt6-20261024.json')))
 foreach($knownPid in @($failed.cleanup.parentProcessId,$failed.cleanup.childProcessId,$second.cleanup.parentProcessId,$second.cleanup.childProcessId,$third.cleanup.parentProcessId,$third.cleanup.childProcessId,$fourth.cleanup.parentProcessId,$fourth.cleanup.childProcessId,$fifth.cleanup.parentProcessId,$fifth.cleanup.childProcessId,$sixth.cleanup.parentProcessId,$sixth.cleanup.childProcessId)){if($knownPid -isnot [int] -or $knownPid -le 0 -or $null -ne (Get-Process -Id $knownPid -ErrorAction SilentlyContinue)){throw 'blocked'}}
 $lockRelative='scripts/n8n/out/foundation/live/runtime.operation.lock'
 $archivePath=[IO.Path]::GetFullPath((Join-Path $repo 'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.runtime-lock'))
 if(-not $archivePath.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
 $stalePresent=Test-Path -LiteralPath (Join-Path $repo $lockRelative);$archived=Test-Path -LiteralPath $archivePath
 if($stalePresent -eq $archived){throw 'blocked'}
 $markerRelative=if($archived){'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.runtime-lock'}else{$lockRelative}
 $markerPath=Safe-File $repo $markerRelative;$entry=Get-Item -LiteralPath $markerPath -Force
 if($entry.PSIsContainer -or $entry.Length -ne 35 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (Get-FileHash -LiteralPath $markerPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'){throw 'blocked'}
 if($archived){return}
 $null=Safe-File $repo 'scripts/n8n/out/foundation'
 # File.Move is atomic within this directory and refuses an existing target.
 [IO.File]::Move($markerPath,$archivePath)
 if((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'){throw 'blocked'}
}
function Invoke-M03Technical13Public([string]$Executable,[string]$Runner,[ValidateSet('RestoreTechnical13','CleanupTechnical16')][string]$RecoveryMode='RestoreTechnical13'){
 $info=$null;$process=$null;$started=$false;$closed=$true;$outMemory=$null;$errMemory=$null;$outBuffer=$null;$errBuffer=$null
 try{
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Executable;$info.Arguments='"'+$Runner+'" '+$RecoveryMode+'CheckOnly';$info.WorkingDirectory=$repo;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$value=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $value){$info.EnvironmentVariables[$name]=$value}};$value=$null
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$started=$process.Start();if(-not $started){throw 'blocked'};$closed=$false;$process.StandardInput.Close()
  $outBuffer=New-Object byte[] 4096;$errBuffer=New-Object byte[] 1024;$outMemory=[IO.MemoryStream]::new([byte[]]$outBuffer,$true);$errMemory=[IO.MemoryStream]::new([byte[]]$errBuffer,$true)
  $stdout=$process.StandardOutput.BaseStream.CopyToAsync($outMemory);$stderr=$process.StandardError.BaseStream.CopyToAsync($errMemory);$closed=$process.WaitForExit(15000)
  if(-not $closed -or $process.ExitCode -ne 0 -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000) -or $errMemory.Position -ne 0){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($outBuffer,0,[int]$outMemory.Position)) -ErrorAction Stop
  $expectedKeys=@('kind','version','status','windowId','privateRead','networkRequests','maximumRequests','maximumControlRequests','executionCount','actorStarts')
  if($RecoveryMode -ceq 'CleanupTechnical16'){$expectedKeys+=@('canonicalWorkflowCount','maximumDrainRequests','maximumNativeRecords','qualifiedSideEffects','cleanupQualificationReady')}
  Assert-M03FoundationObjectKeys $result $expectedKeys
  foreach($name in @('version','networkRequests','maximumRequests','maximumControlRequests','executionCount','actorStarts')){if($result.$name -isnot [int]){throw 'blocked'}}
  if($result.version -ne 1 -or $result.privateRead -isnot [bool] -or $result.privateRead -ne $false -or $result.networkRequests -ne 0 -or $result.executionCount -ne 0 -or $result.actorStarts -ne 0){throw 'blocked'}
  if($RecoveryMode -ceq 'CleanupTechnical16'){
   foreach($name in @('canonicalWorkflowCount','maximumDrainRequests','maximumNativeRecords')){if($result.$name -isnot [int]){throw 'blocked'}}
   if($result.kind -cne 'm03_technical16_cleanup_public' -or $result.status -cne 'technical16_cleanup_public_ready' -or $result.windowId -cne '4c602549-2c42-4ec3-9328-714d7cb66a77' -or $result.maximumRequests -ne 109 -or $result.maximumControlRequests -ne 109 -or $result.canonicalWorkflowCount -ne 25 -or $result.maximumDrainRequests -ne 100 -or $result.maximumNativeRecords -ne 2 -or $result.qualifiedSideEffects -isnot [bool] -or $result.qualifiedSideEffects -ne $false -or $result.cleanupQualificationReady -isnot [bool] -or $result.cleanupQualificationReady -ne $true){throw 'blocked'}
  }elseif($result.kind -cne 'm03_technical13_restoration_public' -or $result.status -cne 'technical13_restore_public_ready' -or $result.windowId -cne '3c46c791-e140-4eb9-890a-eecfa251f65e' -or $result.maximumRequests -ne 40 -or $result.maximumControlRequests -ne 50){throw 'blocked'}
  return $result
 }finally{
  if($null -ne $process){if($started -and -not $closed){try{$process.Kill();$closed=$process.WaitForExit(5000)}catch{}};$process.Dispose()};if($null -ne $info){$info.EnvironmentVariables.Clear()};foreach($stream in @($outMemory,$errMemory)){if($null -ne $stream){$stream.Dispose()}};foreach($bytes in @($outBuffer,$errBuffer)){if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}};if(-not $closed){throw 'blocked'}
 }
}
try{
 if($Mode -cnotin @('Shells','Reconcile','All','RestoreWF00','ProtectWf00Backup','RestoreTechnical13','CleanupTechnical16') -or ($QualificationOnly -and $Mode -cne 'CleanupTechnical16') -or ($CurrentWf00 -and $Mode -cne 'RestoreWF00')){throw 'blocked'}
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
  if($Mode -ceq 'RestoreWF00' -and -not $CurrentWf00){
   $priorJournal=Safe-File $repo 'scripts/n8n/out/foundation/wf00-restore-20261023.jsonl';$entry=Get-Item -LiteralPath $priorJournal -Force
   if($entry.Length -gt 65536 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (Get-FileHash -LiteralPath $priorJournal -Algorithm SHA256).Hash.ToLowerInvariant() -cne '22c18ac86b7e0e03762cf19ad98a33560344af664fcf25f0a45673906fdc955d'){throw 'blocked'}
  }
  if($CurrentWf00){
   $currentFile=Safe-File $repo 'milestones/M03-n8n-foundation/evidence/wf00-current-drift-readback-20261025.json';$entry=Get-Item -LiteralPath $currentFile -Force
   if($entry.Length -gt 65536 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (Get-FileHash -LiteralPath $currentFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne '330d0157f60b7ef29cbafa5407092872506c4c23b02d33e0199bb15e2606e59f'){throw 'blocked'}
   $current=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($currentFile))
   if($current.kind -cne 'm03_wf00_current_drift_readback' -or $current.status -cne 'current_drift_verified' -or $current.observedVersionId -cne 'fe249a62-8276-47c1-a58a-7bb50705a280' -or $current.usageAfter.management -ne 1336 -or $current.usageAfter.control -ne 1250 -or $current.usageAfter.combined -ne 2586 -or $current.usageAfter.vercel -ne 254 -or $current.usageAfter.nativeExecutions -ne 4){throw 'blocked'}
   foreach($pin in $current.pins.PSObject.Properties){$path=Safe-File $repo $pin.Name;$entry=Get-Item -LiteralPath $path -Force;if($entry.PSIsContainer -or $entry.Length -gt 2097152 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or $pin.Value -isnot [string] -or $pin.Value -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin.Value){throw 'blocked'}}
   if(Test-Path -LiteralPath (Join-Path $repo 'scripts/n8n/out/foundation/wf00-restore-fe249a62-8276-47c1-a58a-7bb50705a280.jsonl')){throw 'blocked'}
  }
 }
 if($Mode -cin @('RestoreTechnical13','CleanupTechnical16')){
  $technical13Public=Invoke-M03Technical13Public $node $runner $Mode
 }
}catch{Write-Output 'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.';exit 1}
if($Mode -cin @('RestoreTechnical13','CleanupTechnical16') -and $CheckOnly){$technical13Public|ConvertTo-Json -Compress;exit 0}
if($Mode -ceq 'CleanupTechnical16'){
 $key=$null;$secret=$null;$cipher=$null;$child=$null;$start=$null;$memory=$null;$buffer=$null;$text=$null;$result=$null;$packet=$null;$operationLock=$null;$parentLock=$null;$source=$null;$started=$false;$closed=$true;$forcedStop=$false;$bstr=[IntPtr]::Zero;$exitCode=1
 $receipt=[ordered]@{kind='m03_technical16_native_cleanup';version=1;environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77';sourceCommitSha='5087d4d93d2f6ffdca0bc0096b365723005446fc';status='cleanup_blocked';requestCount=0;controlRequestCount=0;managementAttempts=878;controlAttempts=1009;combinedAttempts=1887;canonicalWorkflowsVerified=0;qualifiedSideEffects=$false;recordsDeleted=0;deleteAcknowledged=$false;absenceVerified=$false;remoteWorkSettled=$false;networkCompletionVerified=$false;originalPublicRecordsUnchanged=$false;nativeAcceptanceProven=$false;originalMaskedFirstFailureRecovered=$false;executionCount=0;actorStarts=0;workflowWrites=0;credentialWrites=0;migrationOperations=0;diagnosticStage='private_helpers';diagnosticCode='not_attempted';nativeExit=$null;childClosed=$true;credentialChildrenClosed=$false;parentLockDeleted=$false;privateRead=$false;persistentManagementRetained=$false}
 try{
  . (Safe-File $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
  $receipt.diagnosticStage='provision_lock';$operationPath=Safe-File $repo 'scripts/n8n/out/foundation/provision.lock'
  $operationLock=[IO.File]::Open($operationPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $marker='M03_FOUNDATION_OPERATION_LOCK df4f29ec-e2dc-4d82-a276-62a4e695e6f9';$actual=New-Object byte[] ([Text.Encoding]::ASCII.GetByteCount($marker))
  if($operationLock.Length -ne $actual.Length -or $operationLock.Read($actual,0,$actual.Length) -ne $actual.Length -or [Text.Encoding]::ASCII.GetString($actual) -cne $marker){throw 'blocked'}
  $receipt.diagnosticStage='prior_processes';foreach($knownPid in @(26268,66008)){if($null -ne (Get-Process -Id $knownPid -ErrorAction SilentlyContinue)){throw 'blocked'}}
  $receipt.diagnosticStage='parent_lock';$parentPath=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
  $null=Assert-M03DevPlainPath (Split-Path -Parent $parentPath) $true;if(Test-Path -LiteralPath $parentPath){throw 'blocked'}
  $parentLock=[IO.File]::Open($parentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Set-M03DevPrivateAcl $parentPath $false
  $owner=[Text.UTF8Encoding]::new($false).GetBytes((([ordered]@{kind='m03_technical16_cleanup_parent';version=1;processId=$PID})|ConvertTo-Json -Compress));$parentLock.Write($owner,0,$owner.Length);$parentLock.Flush($true)
  $receipt.diagnosticStage='failed_attempt_lock';Move-M03Technical16StaleLock
  $receipt.diagnosticStage='management_path';$source=(Get-M03DevCredentialSpec -Kind Management).Source
  $receipt.diagnosticStage='management_directory_acl';Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($source)) $true
  $receipt.diagnosticStage='management_file_acl';Assert-M03DevPrivateAcl $source $false
  $receipt.diagnosticStage='management_cipher_read';$receipt.privateRead=$true;$cipher=[IO.File]::ReadAllBytes($source)
  $receipt.diagnosticStage='management_framing';Assert-M03DevCipherFraming $cipher
  $receipt.diagnosticStage='management_decrypt';$secret=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipher));[Array]::Clear($cipher,0,$cipher.Length);$cipher=$null
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);$key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secret.Dispose();$secret=$null
  if([string]::IsNullOrEmpty($key) -or $key.Length -lt 8 -or $key.Length -gt 4096 -or $key -cmatch '[^\x21-\x7e]'){throw 'blocked'}
  $receipt.diagnosticStage='child_configuration';$start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node;$start.Arguments='"'+$runner+'" '+$(if($QualificationOnly){'CleanupTechnical16Diagnose'}else{'CleanupTechnical16'});$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$value=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $value){$start.EnvironmentVariables[$name]=$value}};$value=$null
  $receipt.diagnosticStage='child_start';$child=[Diagnostics.Process]::new();$child.StartInfo=$start;if(-not $child.Start()){throw 'blocked'};$started=$true;$closed=$false
  $buffer=New-Object byte[] 65536;$memory=[IO.MemoryStream]::new($buffer,0,$buffer.Length,$true,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $receipt.diagnosticStage='child_stdin';$packet=[ordered]@{key=$key;expiresAt=[DateTimeOffset]::UtcNow.AddMinutes(5).ToString('o');purpose='m03_technical16_native_cleanup';windowId='4c602549-2c42-4ec3-9328-714d7cb66a77'}
  $child.StandardInput.Write(($packet|ConvertTo-Json -Compress));$child.StandardInput.Close();$packet=$null
  $receipt.diagnosticStage='child_completion';if(-not $child.WaitForExit(310000)){$forcedStop=$true;throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode
  if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
  $receipt.diagnosticStage='child_output';$text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);if($text.Contains($key)){throw 'blocked'};$result=ConvertFrom-Json -InputObject $text
  $receipt.diagnosticStage='result_contract'
  $keys=@('kind','version','environment','projectRef','windowId','sourceCommitSha','status','requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts','canonicalWorkflowsVerified','qualifiedSideEffects','recordsDeleted','deleteAcknowledged','absenceVerified','remoteWorkSettled','networkCompletionVerified','originalPublicRecordsUnchanged','nativeAcceptanceProven','originalMaskedFirstFailureRecovered','executionCount','actorStarts','workflowWrites','credentialWrites','migrationOperations','diagnosticStage','diagnosticCode')
  Assert-M03FoundationObjectKeys $result $keys
  foreach($name in @('kind','version','environment','projectRef','windowId','sourceCommitSha','nativeAcceptanceProven','originalMaskedFirstFailureRecovered','executionCount','actorStarts','workflowWrites','credentialWrites','migrationOperations')){if($result.$name.GetType() -ne $receipt[$name].GetType() -or $result.$name -cne $receipt[$name]){throw 'blocked'}}
  foreach($name in @('requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts','canonicalWorkflowsVerified','recordsDeleted')){if($result.$name -isnot [int]){throw 'blocked'}}
  if($result.status -cnotin @('cleanup_blocked','cleanup_reconciliation_required','native_cleanup_verified') -or $result.requestCount -lt 0 -or $result.requestCount -gt $(if($QualificationOnly){4}else{109}) -or $result.controlRequestCount -ne $result.requestCount -or $result.managementAttempts -ne 878+$result.requestCount -or $result.controlAttempts -ne 1009+$result.requestCount -or $result.combinedAttempts -ne 1887+2*$result.requestCount -or $result.canonicalWorkflowsVerified -cnotin @(0,25) -or $result.recordsDeleted -lt 0 -or $result.recordsDeleted -gt 2){throw 'blocked'}
  foreach($name in @('qualifiedSideEffects','deleteAcknowledged','absenceVerified','remoteWorkSettled','networkCompletionVerified','originalPublicRecordsUnchanged')){if($result.$name -isnot [bool]){throw 'blocked'}}
  if($QualificationOnly -and ($result.status -ceq 'native_cleanup_verified' -or $result.qualifiedSideEffects -or $result.recordsDeleted -ne 0 -or $result.deleteAcknowledged -or $result.absenceVerified -or $result.remoteWorkSettled -or $result.canonicalWorkflowsVerified -ne 0)){throw 'blocked'}
  if($result.diagnosticStage -cnotin @('one_use_claim','qualification','cleanup','closure','complete') -or $result.diagnosticCode -isnot [string] -or $result.diagnosticCode -cnotmatch '^(none|not_attempted|fixed_boundary_blocked|native_cleanup_residual|native_[A-Z_]{1,64})$'){throw 'blocked'}
  foreach($name in $keys){$receipt[$name]=$result.$name}
  if($result.status -ceq 'native_cleanup_verified'){
   if($receipt.nativeExit -ne 0 -or $result.canonicalWorkflowsVerified -ne 25 -or $result.recordsDeleted -ne 2 -or $result.diagnosticStage -cne 'complete' -or $result.diagnosticCode -cne 'none'){throw 'blocked'}
   foreach($name in @('qualifiedSideEffects','deleteAcknowledged','absenceVerified','remoteWorkSettled','networkCompletionVerified','originalPublicRecordsUnchanged')){if(-not $result.$name){throw 'blocked'}};$exitCode=0
  }
 }catch{$receipt.status='cleanup_reconciliation_required';$receipt.diagnosticCode='fixed_boundary_blocked'}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $cipher){[Array]::Clear($cipher,0,$cipher.Length)};$key=$null;$value=$null;$packet=$null;$secret=$null;$text=$null;$result=$null
  if($null -ne $start){$start.EnvironmentVariables.Clear()}
  if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$forcedStop=$true;$child.Kill()};$closed=$child.WaitForExit(5000);if($closed){$receipt.nativeExit=$child.ExitCode}}catch{$closed=$false}};try{$child.Dispose()}catch{$closed=$false}}
  if($forcedStop){$closed=$false};if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  $receipt.childClosed=$closed;$receipt.credentialChildrenClosed=$closed;if(-not $closed){$exitCode=1;$receipt.status='cleanup_reconciliation_required'}
  if($null -ne $source){$receipt.persistentManagementRetained=Test-Path -LiteralPath $source -PathType Leaf}
  if($null -ne $parentLock){$parentLock.Dispose();if($closed){try{[IO.File]::Delete($parentPath);$receipt.parentLockDeleted=-not (Test-Path -LiteralPath $parentPath)}catch{$exitCode=1;$receipt.status='cleanup_reconciliation_required'}}};if($null -ne $operationLock){$operationLock.Dispose()}
 }
 $receipt|ConvertTo-Json -Compress;exit $exitCode
}
if($CheckOnly){
 $publicResult=[ordered]@{status='foundation_public_seal_ready';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0;maximumRequests=$(if($Mode -ceq 'RestoreWF00'){3}elseif($Mode -ceq 'ProtectWf00Backup'){0}else{185});maximumShellCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{25});maximumTagCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{13});maximumCredentialCreates=$(if($Mode -cin @('RestoreWF00','ProtectWf00Backup')){0}else{1});finalBindingReady=($null -ne $publicPacket)}
 if($CurrentWf00){$publicResult.currentVersionId='fe249a62-8276-47c1-a58a-7bb50705a280';$publicResult.currentReconciliationVerified=$true}
 $publicResult|ConvertTo-Json -Compress
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
if($Mode -ceq 'RestoreTechnical13'){
 $key=$null;$machine=$null;$secret=$null;$cipher=$null;$child=$null;$start=$null;$memory=$null;$buffer=$null;$text=$null;$result=$null;$packet=$null;$operationLock=$null;$parentLock=$null;$source=$null;$machineSource=$null;$started=$false;$closed=$true;$forcedStop=$false;$bstr=[IntPtr]::Zero;$exitCode=1
 $receipt=[ordered]@{kind='m03_technical13_runtime_restoration';version=1;environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';windowId='3c46c791-e140-4eb9-890a-eecfa251f65e';sourceCommitSha='7b1837201ac7925591577a1517d7288936ca3464';status='restoration_blocked';requestCount=0;controlRequestCount=0;managementAttempts=486;controlAttempts=791;combinedAttempts=1277;baselineRestored=$false;machineRestored=$false;remoteWorkSettled=$false;executionCount=0;actorStarts=0;originalAckUnknown=$true;mutationReplayAllowed=$false;oldRuntimeUnchanged=$true;networkCompletionVerified=$false;nativeExit=$null;childClosed=$true;credentialChildrenClosed=$false;parentLockDeleted=$false;privateRead=$false;persistentManagementRetained=$false;pendingMachineStoreRetained=$false;diagnosticStage='private_helpers';diagnosticCode='not_attempted'}
 try{
  . (Safe-File $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
  $receipt.diagnosticStage='provision_lock'
  $operationPath=Safe-File $repo 'scripts/n8n/out/foundation/provision.lock'
  $operationLock=[IO.File]::Open($operationPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $marker='M03_FOUNDATION_OPERATION_LOCK df4f29ec-e2dc-4d82-a276-62a4e695e6f9';$actual=New-Object byte[] ([Text.Encoding]::ASCII.GetByteCount($marker))
  if($operationLock.Length -ne $actual.Length -or $operationLock.Read($actual,0,$actual.Length) -ne $actual.Length -or [Text.Encoding]::ASCII.GetString($actual) -cne $marker){throw 'blocked'}
  $receipt.diagnosticStage='prior_processes';foreach($knownPid in @(50680,30264)){if($null -ne (Get-Process -Id $knownPid -ErrorAction SilentlyContinue)){throw 'blocked'}}
  $receipt.diagnosticStage='parent_lock'
  $parentPath=Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'
  $null=Assert-M03DevPlainPath (Split-Path -Parent $parentPath) $true
  if(Test-Path -LiteralPath $parentPath){throw 'blocked'}
  $parentLock=[IO.File]::Open($parentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read);Set-M03DevPrivateAcl $parentPath $false
  $owner=[Text.UTF8Encoding]::new($false).GetBytes((([ordered]@{kind='m03_technical13_restore_parent';version=1;processId=$PID})|ConvertTo-Json -Compress));$parentLock.Write($owner,0,$owner.Length);$parentLock.Flush($true)
  $receipt.diagnosticStage='credential_paths';$source=(Get-M03DevCredentialSpec -Kind Management).Source
  $machineSource=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi'
  foreach($privateFile in @($source,$machineSource)){
   $credentialKind=if($privateFile -ceq $source){'management'}else{'machine'}
   $receipt.diagnosticStage=$credentialKind+'_directory_acl';Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($privateFile)) $true
   $receipt.diagnosticStage=$credentialKind+'_file_acl';Assert-M03DevPrivateAcl $privateFile $false
   $receipt.diagnosticStage=$credentialKind+'_cipher_read';$receipt.privateRead=$true;$cipher=[IO.File]::ReadAllBytes($privateFile)
   $receipt.diagnosticStage=$credentialKind+'_framing';Assert-M03DevCipherFraming $cipher
   $receipt.diagnosticStage=$credentialKind+'_decrypt'
   $secret=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipher));[Array]::Clear($cipher,0,$cipher.Length);$cipher=$null
   $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secret.Dispose();$secret=$null
   $receipt.diagnosticStage=$credentialKind+'_plaintext';if([string]::IsNullOrEmpty($value) -or $value.Length -lt 8 -or $value.Length -gt 4096 -or $value -cmatch '[^\x21-\x7e]'){throw 'blocked'}
   if($privateFile -ceq $source){$key=$value}else{$machine=$value};$value=$null
  }
  $receipt.diagnosticStage='child_configuration';$start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node;$start.Arguments='"'+$runner+'" RestoreTechnical13';$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$value=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $value){$start.EnvironmentVariables[$name]=$value}};$value=$null
  $receipt.diagnosticStage='child_start';$child=[Diagnostics.Process]::new();$child.StartInfo=$start;if(-not $child.Start()){throw 'blocked'};$started=$true;$closed=$false
  $buffer=New-Object byte[] 65536;$memory=[IO.MemoryStream]::new($buffer,0,$buffer.Length,$true,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $receipt.diagnosticStage='child_stdin';$packet=[ordered]@{key=$key;machine=$machine;expiresAt=[DateTimeOffset]::UtcNow.AddMinutes(5).ToString('o');purpose='m03_technical13_runtime_restoration';windowId='3c46c791-e140-4eb9-890a-eecfa251f65e'}
  $child.StandardInput.Write(($packet|ConvertTo-Json -Compress));$child.StandardInput.Close();$packet=$null
  $receipt.diagnosticStage='child_completion';if(-not $child.WaitForExit(310000)){$forcedStop=$true;throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode
  if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
  $receipt.diagnosticStage='child_output';$text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);if($text.Contains($key) -or $text.Contains($machine)){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $text
  $receipt.diagnosticStage='result_contract'
  $keys=@('kind','version','environment','projectRef','windowId','sourceCommitSha','status','requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts','baselineRestored','machineRestored','remoteWorkSettled','executionCount','actorStarts','originalAckUnknown','mutationReplayAllowed','oldRuntimeUnchanged','networkCompletionVerified')
  Assert-M03FoundationObjectKeys $result $keys
  foreach($name in @('kind','version','environment','projectRef','windowId','sourceCommitSha','executionCount','actorStarts','originalAckUnknown','mutationReplayAllowed')){if($result.$name.GetType() -ne $receipt[$name].GetType() -or $result.$name -cne $receipt[$name]){throw 'blocked'}}
  if($result.status -cnotin @('restoration_verified','restoration_blocked','restoration_reconciliation_required') -or $result.requestCount -isnot [int] -or $result.requestCount -lt 0 -or $result.requestCount -gt 40 -or $result.controlRequestCount -isnot [int] -or $result.controlRequestCount -lt 0 -or $result.controlRequestCount -gt 50 -or $result.managementAttempts -isnot [int] -or $result.controlAttempts -isnot [int] -or $result.combinedAttempts -isnot [int] -or $result.managementAttempts -ne 486+$result.requestCount -or $result.controlAttempts -ne 791+$result.controlRequestCount -or $result.combinedAttempts -ne $result.managementAttempts+$result.controlAttempts){throw 'blocked'}
  foreach($name in @('baselineRestored','machineRestored','remoteWorkSettled','oldRuntimeUnchanged','networkCompletionVerified')){if($result.$name -isnot [bool]){throw 'blocked'}}
  foreach($name in $keys){$receipt[$name]=$result.$name}
  if($result.status -ceq 'restoration_verified'){
   if($receipt.nativeExit -ne 0 -or $result.controlRequestCount -ne 50){throw 'blocked'}
   foreach($name in @('baselineRestored','machineRestored','remoteWorkSettled','oldRuntimeUnchanged','networkCompletionVerified')){if(-not $result.$name){throw 'blocked'}};$exitCode=0
  }
  $receipt.diagnosticStage='complete';$receipt.diagnosticCode=if($exitCode -eq 0){'none'}else{'child_reported_residual'}
 }catch{$receipt.status='restoration_blocked';$receipt.diagnosticCode='local_boundary_blocked'}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $cipher){[Array]::Clear($cipher,0,$cipher.Length)};$key=$null;$machine=$null;$value=$null;$packet=$null;$secret=$null;$text=$null;$result=$null
  if($null -ne $start){$start.EnvironmentVariables.Clear()}
  if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$forcedStop=$true;$child.Kill()};$closed=$child.WaitForExit(5000);if($closed){$receipt.nativeExit=$child.ExitCode}}catch{$closed=$false}};try{$child.Dispose()}catch{$closed=$false}}
  if($forcedStop){$closed=$false};if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  $receipt.childClosed=$closed;$receipt.credentialChildrenClosed=$closed;if(-not $closed){$exitCode=1}
  if($null -ne $source){$receipt.persistentManagementRetained=Test-Path -LiteralPath $source -PathType Leaf};if($null -ne $machineSource){$receipt.pendingMachineStoreRetained=Test-Path -LiteralPath $machineSource -PathType Leaf}
  if($null -ne $parentLock){$parentLock.Dispose();if($closed){try{[IO.File]::Delete($parentPath);$receipt.parentLockDeleted=-not (Test-Path -LiteralPath $parentPath)}catch{$exitCode=1}}};if($null -ne $operationLock){$operationLock.Dispose()}
 }
 $receipt|ConvertTo-Json -Compress;exit $exitCode
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
  $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node;$start.Arguments='"'+$runner+'" RestoreWF00'+$(if($CurrentWf00){' --current-wf00'}else{''});$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
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
