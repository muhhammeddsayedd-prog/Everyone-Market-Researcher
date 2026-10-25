# Public-only foundation closure. No process launch, private path, DPAPI or network.
# A consumer must verify this file's sealed hash before dot-sourcing it.
function Get-M03FoundationPublicSourceFiles {
 return @(
  'scripts/n8n/windows/New-M03FoundationHandoff.ps1',
  'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1',
  'scripts/n8n/windows/Get-M03FoundationPendingMachine.ps1',
  'scripts/n8n/windows/Dev-CredentialStore.ps1',
  'scripts/n8n/foundation-provision.mjs',
  'scripts/n8n/foundation-provision-cli.mjs',
  'scripts/n8n/foundation-management-transport.mjs',
  'scripts/n8n/foundation-bind.mjs',
  'scripts/n8n/foundation-all.mjs',
  'scripts/n8n/foundation-export.mjs',
  'scripts/n8n/foundation-runtime-checkpoint.mjs',
  'scripts/n8n/inventory.mjs',
  'scripts/n8n/foundation-callback-cases.mjs',
  'scripts/n8n/foundation-control-state.mjs',
  'scripts/n8n/foundation-live-domain-probe.mjs',
  'scripts/n8n/foundation-live-project-verified-continuation.mjs',
  'scripts/n8n/foundation-live-remaining-continuation.mjs',
  'scripts/n8n/foundation-live-runtime-transport.mjs',
  'scripts/n8n/foundation-live-startup-replacement.mjs',
  'scripts/n8n/foundation-native-reader.mjs',
  'scripts/n8n/foundation-native-cleanup.mjs',
  'scripts/n8n/foundation-execution-control.mjs',
  'scripts/n8n/foundation-native-controller.mjs',
  'scripts/n8n/foundation-native-settlement.mjs',
  'scripts/n8n/foundation-native-transport.mjs',
  'scripts/n8n/foundation-retention-proposal.mjs',
  'scripts/n8n/foundation-runtime-control.mjs',
  'scripts/n8n/foundation-runtime-machine.mjs',
  'scripts/n8n/foundation-runtime-plan.mjs',
  'scripts/n8n/gw01-writer.mjs',
  'packages/shared/src/n8n-bindings.ts',
  'packages/shared/src/n8n-apify-recovery.ts',
  'packages/shared/src/n8n-schedule.ts',
  'n8n/foundation/bindings.dev.json',
  'n8n/foundation/transport.dev.json',
  'n8n/workflows/WF-00.json',
  'n8n/workflows/SUB-COST.json',
  'n8n/workflows/SUB-FINISH.json',
  'n8n/workflows/SUB-INGEST.json',
  'n8n/workflows/SUB-NOTIFY.json',
  'n8n/workflows/SUB-START.json',
  'n8n/workflows/WF-10.json',
  'n8n/workflows/WF-11.json',
  'n8n/workflows/WF-12.json',
  'n8n/workflows/WF-13.json',
  'n8n/workflows/WF-18.json',
  'n8n/workflows/WF-18b.json',
  'n8n/workflows/WF-19.json',
  'n8n/workflows/WF-21.json',
  'n8n/workflows/WF-22.json',
  'n8n/workflows/WF-23.json',
  'n8n/workflows/WF-30.json',
  'n8n/workflows/WF-32.json',
  'n8n/workflows/WF-40.json',
  'n8n/workflows/WF-50.json',
  'n8n/workflows/WF-70.json',
  'n8n/workflows/WF-80.json',
  'n8n/workflows/WF-90.json',
  'n8n/workflows/WF-91.json',
  'n8n/workflows/WF-99.json',
  'n8n/fixtures/WF-00-reviewed-native-staging-025c2a2.json',
  'n8n/foundation/build-foundation.mjs',
  'n8n/foundation/build-foundation-gateway.mjs',
  'n8n/foundation/build-foundation-callback.mjs',
  'n8n/foundation/build-foundation-smoke.mjs',
  'n8n/foundation/build-apify-callback.mjs',
  'n8n/foundation/build-health.mjs',
  'n8n/foundation/build-orchestrator.mjs',
  'n8n/foundation/materialize-acceptance-case.mjs',
  'n8n/normalizers/package.json',
  'n8n/normalizers/smoke_website_stub.js',
  'n8n/normalizers/smoke_website_m03.js',
  'scripts/n8n/windows/Foundation-PublicRuntime.ps1',
  'scripts/n8n/windows/New-M03FoundationPublicSeal.ps1',
  'milestones/M03-n8n-foundation/evidence/sanitizedprobe.json',
  'milestones/M03-n8n-foundation/evidence/wf00-restore-approval-20261023.json',
  'milestones/M03-n8n-foundation/evidence/wf00-restore-attempt-20261023.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-postclose-custody-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-postclose-db-readback-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt2-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt3-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt4-20261024.json'
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt5-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt6-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-public-transport-diagnostics-20261024.json',
  'milestones/M03-n8n-foundation/evidence/technical16-wf32-discovery-readback-20261024.json',
  'milestones/M03-n8n-foundation/evidence/local-native-parameter-defaults-20261024.json',
  'package.json',
  'scripts/package.json',
  'packages/shared/package.json',
  'n8n/foundation/package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml'
 )
}

function Get-M03FoundationPhysicalPath([string]$Path,[switch]$File) {
 $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
 while($null -ne $cursor){
  $entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
  if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  $parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}
 }
 if($File -and (Get-Item -LiteralPath $absolute -Force -ErrorAction Stop).PSIsContainer){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 return $absolute
}

function Get-M03FoundationPublicFile([string]$Root,[string]$Relative) {
 if($Relative -cnotmatch '^[A-Za-z0-9_-][A-Za-z0-9_./-]*$' -or $Relative.Contains('..')){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 $file=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
 if(-not $file.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 return Get-M03FoundationPhysicalPath $file -File
}

function Get-M03FoundationPublicHash([string]$Path) {
 return (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
}

function Assert-M03FoundationObjectKeys($Value,[string[]]$Expected) {
 if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
}

function Get-M03FoundationZodRuntime([string]$Root) {
 $relative='node_modules/.pnpm/zod@4.6.7/node_modules/zod'
 $physical=Get-M03FoundationPhysicalPath (Join-Path $Root $relative)
 $modules=Get-M03FoundationPhysicalPath (Join-Path $Root 'packages/shared/node_modules')
 $linkRelative='packages/shared/node_modules/zod'
 $link=Get-Item -LiteralPath (Join-Path $Root $linkRelative) -Force -ErrorAction Stop
 if(($link.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or @($link.Target).Count -ne 1 -or @($link.Target)[0] -isnot [string]){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 $target=[IO.Path]::GetFullPath([IO.Path]::Combine($modules,@($link.Target)[0]))
 if(-not $target.Equals($physical,[StringComparison]::OrdinalIgnoreCase)){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 $packageFile=Get-M03FoundationPublicFile $physical 'package.json'
 if((Get-Item -LiteralPath $packageFile).Length -gt 65536){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 $package=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($packageFile)) -ErrorAction Stop
 if($package.name -isnot [string] -or $package.name -cne 'zod' -or $package.version -isnot [string] -or $package.version -cne '4.6.7' -or $package.type -isnot [string] -or $package.type -cne 'module'){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 # Pin every physical package file, including package exports/type scopes. Added
 # files also invalidate the seal. The sole permitted link is checked above.
 $queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue($physical)
 $paths=New-Object 'Collections.Generic.List[string]';$entries=0;$bytes=0L
 while($queue.Count -gt 0){
  foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force -ErrorAction Stop){
   $entries++;if($entries -gt 5000 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or -not $entry.FullName.StartsWith($physical+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
   if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}else{
    $bytes+=$entry.Length
    if($entry.Length -gt 16777216 -or $bytes -gt 33554432 -or $paths.Count -ge 2000){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
    $paths.Add($entry.FullName.Substring($physical.Length+1).Replace('\','/'))
   }
  }
 }
 $files=[ordered]@{}
 foreach($path in @($paths|Sort-Object)){$files[$path]=Get-M03FoundationPublicHash (Get-M03FoundationPublicFile $physical $path)}
 return [ordered]@{rootRelative=$relative;linkRelative=$linkRelative;linkTarget=$target;files=$files}
}

function New-M03FoundationPublicRuntimeSeal {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][string]$RepositoryRoot,[string]$NodeExecutable)
 try{
  $root=Get-M03FoundationPhysicalPath $RepositoryRoot
  # TypeScript's nearest package scope and bare-import search may otherwise
  # change without touching any pinned import. These resolution boundaries are
  # absent in the reviewed tree and may not be introduced silently.
  foreach($relative in @('packages/shared/src/package.json','packages/shared/src/node_modules','scripts/n8n/package.json','n8n/package.json')){
   if(Test-Path -LiteralPath (Join-Path $root $relative)){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  }
  if([string]::IsNullOrEmpty($NodeExecutable)){$NodeExecutable=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source}
  $node=Get-M03FoundationPhysicalPath $NodeExecutable -File
  if([IO.Path]::GetFileName($node) -cne 'node.exe'){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  $files=[ordered]@{}
  foreach($relative in @(Get-M03FoundationPublicSourceFiles|Sort-Object)){$files[$relative]=Get-M03FoundationPublicHash (Get-M03FoundationPublicFile $root $relative)}
  $zod=Get-M03FoundationZodRuntime $root
  $packetSha256=$null;$packetRelative='scripts/n8n/foundation-delivery-packet.json'
  if(Test-Path -LiteralPath (Join-Path $root $packetRelative)){
   $packet=Get-M03FoundationPublicFile $root $packetRelative
   if((Get-Item -LiteralPath $packet).Length -gt 4096){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
   $packetSha256=Get-M03FoundationPublicHash $packet
  }
  return [ordered]@{version=2;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';files=$files;node=[ordered]@{path=$node;sha256=(Get-M03FoundationPublicHash $node)};zod=$zod;packetSha256=$packetSha256}
 }catch{throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
}

function Assert-M03FoundationPublicHashMap($Expected,$Actual) {
 Assert-M03FoundationObjectKeys $Expected @($Actual.Keys)
 foreach($relative in $Actual.Keys){
  $pin=$Expected.PSObject.Properties[$relative].Value
  if($pin -isnot [string] -or $pin -cnotmatch '^[a-f0-9]{64}$' -or $pin -cne $Actual[$relative]){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
 }
}

function Assert-M03FoundationPublicRuntimeSeal {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][string]$RepositoryRoot,[Parameter(Mandatory=$true)]$Seal,[Parameter(Mandatory=$true)][string]$SelectedNodeExecutable)
 try{
  Assert-M03FoundationObjectKeys $Seal @('version','windowId','files','node','zod','packetSha256')
  if($Seal.version -isnot [int] -or $Seal.version -ne 2 -or $Seal.windowId -isnot [string] -or $Seal.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  $actual=New-M03FoundationPublicRuntimeSeal -RepositoryRoot $RepositoryRoot -NodeExecutable $SelectedNodeExecutable
  Assert-M03FoundationPublicHashMap $Seal.files $actual.files
  Assert-M03FoundationObjectKeys $Seal.node @('path','sha256')
  if($Seal.node.path -isnot [string] -or $Seal.node.path -cne $actual.node.path -or $Seal.node.sha256 -isnot [string] -or $Seal.node.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $Seal.node.sha256 -cne $actual.node.sha256){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  Assert-M03FoundationObjectKeys $Seal.zod @('rootRelative','linkRelative','linkTarget','files')
  foreach($key in @('rootRelative','linkRelative','linkTarget')){if($Seal.zod.$key -isnot [string] -or $Seal.zod.$key -cne $actual.zod[$key]){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}}
  Assert-M03FoundationPublicHashMap $Seal.zod.files $actual.zod.files
  if($null -eq $actual.packetSha256){if($null -ne $Seal.packetSha256){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}}elseif($Seal.packetSha256 -isnot [string] -or $Seal.packetSha256 -cnotmatch '^[a-f0-9]{64}$' -or $Seal.packetSha256 -cne $actual.packetSha256){throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
  return $actual.node.path
 }catch{throw 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'}
}
