[CmdletBinding()]
param([ValidateSet('Shells','Reconcile','All')][string]$Mode='All',[switch]$CheckOnly)
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
}catch{Write-Output 'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.';exit 1}
if($CheckOnly){
 [ordered]@{status='foundation_public_seal_ready';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0;maximumRequests=185;maximumShellCreates=25;maximumTagCreates=13;maximumCredentialCreates=1;finalBindingReady=($null -ne $publicPacket)}|ConvertTo-Json -Compress
 exit 0
}
$secret=$null;$key=$null;$machine=$null;$machineSecret=$null;$bstr=[IntPtr]::Zero;$child=$null;$start=$null;$memory=$null;$buffer=$null;$operationLock=$null;$closed=$true;$started=$false;$consumed=$false;$exitCode=1
$receipt=[ordered]@{version=1;status='blocked';nativeExit=$null;childClosed=$true;requestCount=0;verifiedWorkflows=0;handoffDeleted=$false;leaseDeleted=$false;finalBindingReady=$false;pendingMachineStoreRetained=$false;operationLockAcquired=$false;privateRead=$false;diagnostics=$null}
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
  $machineSecret=Get-M03FoundationPendingMachine -Audience $publicPacket.audience -SourceCommitSha $publicPacket.sourceCommitSha
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
 if($result.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $result.host -cne 'muhhammedsayed.app.n8n.cloud' -or $result.projectId -cne 'pHvQjDmjxVZ3KQLT' -or $result.requestCount -lt 0 -or $result.requestCount -gt 185 -or $result.executionCount -ne 0 -or $result.credentialsCreated -lt 0 -or $result.credentialsCreated -gt 1 -or $result.gatewayWindowStarted -isnot [bool] -or $result.gatewayWindowStarted -ne $false -or $result.finalGraphsBound -isnot [bool] -or ($Mode -cne 'All' -and $result.finalGraphsBound -ne $false)){throw 'blocked'}
 $receipt.status=$result.status;$receipt.requestCount=$result.requestCount;$receipt.verifiedWorkflows=$result.verifiedWorkflows;$receipt.finalBindingReady=$result.finalGraphsBound
 $diagnosticProperty=$result.PSObject.Properties['diagnostics']
 if($null -ne $diagnosticProperty -and $null -ne $diagnosticProperty.Value){
  $d=$diagnosticProperty.Value
  if(@(Compare-Object -CaseSensitive @('lastMethod','lastResource','httpStatus','transportCode','transportReason'|Sort-Object) @($d.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $d.lastMethod -cnotin @('GET','POST','PUT') -or $d.lastResource -cnotin @('credential_schema','owned_credential','tags','projects','owned_workflows') -or ($null -ne $d.httpStatus -and ($d.httpStatus -isnot [int] -or $d.httpStatus -lt 100 -or $d.httpStatus -gt 599)) -or ($null -ne $d.transportCode -and ($d.transportCode -isnot [string] -or ($d.transportCode -cne 'unclassified' -and $d.transportCode -cnotmatch '^FOUNDATION_(?:TRANSPORT_(?:DNS|CLOSE|TLS|STATUS|BODY|PARSE|DEADLINE)|REQUEST_REJECTED)$'))) -or ($null -ne $d.transportReason -and ($d.transportReason -isnot [string] -or $d.transportReason -cnotin @('lease_expired','request_not_allowed','dns_rejected','socket_not_closed','response_incomplete','request_timeout','response_aborted','response_error','status_invalid','content_encoding_rejected','transfer_framing_rejected','content_length_invalid','body_declared_limit','body_stream_limit','body_incomplete','body_length_mismatch','utf8_invalid','json_invalid','duplicate_socket','socket_error','request_error','request_failed')))){throw 'blocked'}
  $receipt.diagnostics=$d
 }
 if($receipt.nativeExit -eq 0 -and $result.status -cin @('shells_verified','reconciliation_complete','inactive_foundation_verified')){$exitCode=0}
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
