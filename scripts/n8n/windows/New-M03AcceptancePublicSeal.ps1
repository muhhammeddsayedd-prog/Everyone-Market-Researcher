[CmdletBinding()]
param([switch]$ReplaceReviewedSeal)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$owned=$false;$stream=$null;$temporary=$null
try {
 # Explicit public builder only; private consumer never creates/replaces seals.
 . (Join-Path $PSScriptRoot 'Acceptance-PublicRuntime.ps1')
 . (Join-Path $PSScriptRoot 'Foundation-PublicRuntime.ps1')
 $base=New-M03FoundationPublicRuntimeSeal -RepositoryRoot $repo
 $files=[ordered]@{}
 foreach($relative in (Get-M03AcceptancePublicFiles $repo)){
  $path=Get-M03AcceptancePhysicalPath (Join-Path $repo $relative) -File
  $files[$relative]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
 }
 $vercel=New-M03AcceptanceVercelClosure 'C:\Users\iway\AppData\Roaming\npm\node_modules\vercel'
 # The old public dist hashes remain provenance only. No GW-01 window, token,
 # bypass, authentication, deployment or execution authority is reused.
 $oldPublic=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Get-M03AcceptancePhysicalPath (Join-Path $repo 'scripts/n8n/gw01-gateway-seal.json') -File)))
 if($oldPublic.vercelFiles -isnot [PSCustomObject]){throw 'blocked'}
 foreach($property in $oldPublic.vercelFiles.PSObject.Properties){
  if($property.Value -isnot [string] -or $property.Value -cnotmatch '^[a-f0-9]{64}$' -or $vercel.files.($property.Name) -cne $property.Value){throw 'blocked'}
 }
 $seal=[ordered]@{
  version=1
  windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
  approvedHead='f42930f90c2de43c84f61ad6d966d0ee6074d70e'
  approvedPacketSha256='009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712'
  files=$files
  base=$base
  vercel=$vercel
 }
 $destination=Join-Path $repo 'scripts/n8n/foundation-acceptance-seal.json'
 if(Test-Path -LiteralPath $destination){
  $null=Get-M03AcceptancePhysicalPath $destination -File
  if(-not $ReplaceReviewedSeal){throw 'blocked'}
 }
 $temporary=Join-Path $repo 'scripts/n8n/.foundation-acceptance-seal.pending'
 $stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$owned=$true
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($seal|ConvertTo-Json -Depth 12))
 if($bytes.Length -gt 2097152){throw 'blocked'}
 $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
 $parsed=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($temporary))
 $null=Assert-M03AcceptancePublicSeal $repo $parsed
 if(Test-Path -LiteralPath $destination){[IO.File]::Replace($temporary,$destination,[NullString]::Value)}else{[IO.File]::Move($temporary,$destination)}
 $owned=$false
 [ordered]@{status='acceptance_public_seal_ready';privateRead=$false;networkRequests=0;projectFiles=$files.Count;runtimeFiles=$base.zod.files.Count}|ConvertTo-Json -Compress
 exit 0
} catch {
 Write-Output 'M03_ACCEPTANCE_PUBLIC_SEAL_BLOCKED';exit 1
} finally {
 if($null -ne $stream){$stream.Dispose()}
 if($owned -and $null -ne $temporary){try{[IO.File]::Delete($temporary)}catch{}}
}
