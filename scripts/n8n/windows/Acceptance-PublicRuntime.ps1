# Public-only source closure for the approved A-D batch. No DPAPI or network.
function Get-M03AcceptancePhysicalPath([string]$Path,[switch]$File) {
 $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
 while($null -ne $cursor){
  $attributes=[IO.File]::GetAttributes($cursor)
  if(($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
  $parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}
 }
 if($File -and ([IO.File]::GetAttributes($absolute) -band [IO.FileAttributes]::Directory) -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 return $absolute
}
function Get-M03AcceptancePublicFiles([string]$Root) {
 $files=@(
  'scripts/n8n/windows/Acceptance-PublicRuntime.ps1',
  'scripts/n8n/windows/New-M03AcceptancePublicSeal.ps1',
  'scripts/n8n/windows/New-M03AcceptanceHandoff.ps1',
  'scripts/n8n/windows/Dev-CredentialStore.ps1',
  'scripts/n8n/windows/Invoke-M03Acceptance.ps1',
  'scripts/n8n/windows/Foundation-PublicRuntime.ps1',
  'scripts/n8n/foundation-live-runtime-cli.mjs',
  'scripts/db/foundation-admin-client.mjs',
  'scripts/db/windows/Invoke-M03FoundationMigrations.ps1',
  'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1',
  'scripts/db/windows/Foundation-AdminControl.ps1',
  'scripts/db/m03-foundation-dev-migration-packet.json',
  'scripts/db/foundation-postcheck.sql',
  'scripts/db/foundation-replay-snapshot.sql',
  'scripts/db/foundation-settlement.sql',
  'scripts/db/check-foundation-types.mjs',
  'scripts/assert/m03_smoke_setup.sql',
  'scripts/assert/m03_smoke_teardown.sql',
  'scripts/assert/m03_smoke_assert.sql',
  'scripts/assert/m03_smoke_reactivate.sql',
  'scripts/assert/m03_smoke_reactivate_startup.sql',
  'scripts/assert/m03_smoke_reactivate_project_verified.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-packet-20261022.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-authorization-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-zero-setup-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-approval-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-amendment-20261021.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-late-delivery-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-approval-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-continuation-20261021.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-amended-attempt-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-packet-20261022.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-vercel-postlogin-actual-20261022.json',
  'milestones/M03-n8n-foundation/evidence/m03-c01-retention-proposal-20261019.json'
 )
 foreach($relative in @('scripts/n8n','n8n/foundation')){
  $directory=Get-M03AcceptancePhysicalPath (Join-Path $Root $relative)
  foreach($entry in Get-ChildItem -LiteralPath $directory -File -Force){
   if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
   if(($entry.Name -cmatch '^foundation-.*\.(?:mjs|cjs)$' -or $relative -ceq 'n8n/foundation' -and $entry.Extension -cin @('.mjs','.json')) -and $entry.Name -cnotmatch '\.test\.mjs$'){
    $files+=($relative+'/'+$entry.Name)
   }
  }
 }
 foreach($entry in Get-ChildItem -LiteralPath (Get-M03AcceptancePhysicalPath (Join-Path $Root 'n8n/workflows')) -File -Filter '*.json'){
  $files+=('n8n/workflows/'+$entry.Name)
 }
 return @($files|Sort-Object -Unique -CaseSensitive)
}
function Import-M03AcceptanceFoundationPublicModule([string]$Root,$BaseSeal) {
 $path=Get-M03AcceptancePhysicalPath (Join-Path $Root 'scripts/n8n/windows/Foundation-PublicRuntime.ps1') -File
 $expected=$BaseSeal.files.'scripts/n8n/windows/Foundation-PublicRuntime.ps1'
 if($expected -isnot [string] -or $expected -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 # Dot source in caller scope through a validated returned path; no private data.
 return $path
}
function Assert-M03AcceptancePublicSeal([string]$Root,$Seal) {
 $keys=@('version','windowId','approvedHead','approvedPacketSha256','files','base','vercel')
 if($Seal -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($keys|Sort-Object) @($Seal.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $Seal.version -isnot [int] -or $Seal.version -ne 1 -or $Seal.windowId -isnot [string] -or $Seal.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $Seal.approvedHead -isnot [string] -or $Seal.approvedHead -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $Seal.approvedPacketSha256 -isnot [string] -or $Seal.approvedPacketSha256 -cne '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712' -or $Seal.files -isnot [PSCustomObject]){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 $expected=Get-M03AcceptancePublicFiles $Root
 if($expected.Count -gt 200 -or @(Compare-Object -CaseSensitive @($expected|Sort-Object) @($Seal.files.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 foreach($relative in $expected){
  $path=Get-M03AcceptancePhysicalPath (Join-Path $Root $relative) -File
  if($Seal.files.$relative -isnot [string] -or $Seal.files.$relative -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Seal.files.$relative){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 }
 . (Import-M03AcceptanceFoundationPublicModule $Root $Seal.base)
 $null=Assert-M03FoundationPublicRuntimeSeal -RepositoryRoot $Root -Seal $Seal.base -SelectedNodeExecutable $Seal.base.node.path
 $null=Assert-M03AcceptanceVercelClosure $Seal.vercel
 return $Seal.base.node.path
}
function Get-M03AcceptanceVercelFiles([string]$Root) {
 $root=Get-M03AcceptancePhysicalPath $Root
 $packagePath=Get-M03AcceptancePhysicalPath (Join-Path $root 'package.json') -File
 if((Get-Item -LiteralPath $packagePath).Length -gt 1048576){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 $package=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($packagePath))
 if($package.name -cne 'vercel' -or $package.version -cne '56.5.0'){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 # dist is not self-contained: index imports external cli-config/detect-agent;
 # cli-config then resolves root-local zod/xdg-app-paths. Seal all installed
 # executable code and JSON resolution manifests below BOTH physical trees.
 # Declaration-only TS is not executable; native binaries and WASM are included.
 $paths=[Collections.Generic.List[string]]::new();$paths.Add('package.json')
 $queue=[Collections.Generic.Queue[string]]::new()
 foreach($tree in @('dist','node_modules')){$queue.Enqueue((Get-M03AcceptancePhysicalPath (Join-Path $root $tree)))}
 $count=0;$totalBytes=[long](Get-Item -LiteralPath (Join-Path $root 'package.json')).Length
 while($queue.Count -gt 0){
  foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
   $count++;if($count -gt 40000 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
   if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}
   elseif($entry.Extension -cin @('.js','.mjs','.cjs','.json','.wasm','.node','.ts','.mts','.cts','.exe','.dll') -and $entry.Name -cnotmatch '\.d\.(?:ts|mts|cts)$'){
    if($entry.Length -gt 67108864){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
    $totalBytes+=$entry.Length
    if($totalBytes -gt 268435456 -or $paths.Count -ge 8000){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
    $paths.Add($entry.FullName.Substring($root.Length+1).Replace('\','/'))
   }
  }
 }
 return @($paths|Sort-Object -Unique -CaseSensitive)
}
function New-M03AcceptanceVercelClosure([string]$Root) {
 $files=[ordered]@{}
 foreach($relative in (Get-M03AcceptanceVercelFiles $Root)){
  $files[$relative]=(Get-FileHash -LiteralPath (Get-M03AcceptancePhysicalPath (Join-Path $Root $relative) -File) -Algorithm SHA256).Hash.ToLowerInvariant()
 }
 return [PSCustomObject]@{root=[IO.Path]::GetFullPath($Root);files=[PSCustomObject]$files}
}
function Assert-M03AcceptanceVercelClosure($Value) {
 if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @('root','files'|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $Value.root -isnot [string] -or $Value.root -cne 'C:\Users\iway\AppData\Roaming\npm\node_modules\vercel' -or $Value.files -isnot [PSCustomObject]){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 $root=Get-M03AcceptancePhysicalPath $Value.root
 $paths=Get-M03AcceptanceVercelFiles $root
 if(@(Compare-Object -CaseSensitive @($paths|Sort-Object) @($Value.files.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 foreach($relative in $paths){
  if($Value.files.$relative -isnot [string] -or $Value.files.$relative -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Get-M03AcceptancePhysicalPath (Join-Path $root $relative) -File) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Value.files.$relative){throw 'M03_ACCEPTANCE_SOURCE_BLOCKED'}
 }
}
