# Explicit public-only build after source review. Never invoked by the private consumer.
[CmdletBinding()]
param([switch]$ReplaceReviewedSeal)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$temporary=$null;$owned=$false;$stream=$null
try{
 # This owner-selected public builder is reviewed with the module. The private
 # consumer instead checks the module's existing seal hash BEFORE importing it.
 . (Join-Path $PSScriptRoot 'Foundation-PublicRuntime.ps1')
 $seal=New-M03FoundationPublicRuntimeSeal -RepositoryRoot $repo
 $directory=Get-M03FoundationPhysicalPath (Join-Path $repo 'scripts/n8n')
 $destination=Join-Path $directory 'foundation-provision-seal.json'
 $text=($seal|ConvertTo-Json -Depth 8)+[Environment]::NewLine
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes($text)
 if($bytes.Length -gt 262144){throw 'blocked'}
 if(Test-Path -LiteralPath $destination){
  $null=Get-M03FoundationPhysicalPath $destination -File
  if(-not $ReplaceReviewedSeal){throw 'blocked'}
 }
 $temporary=Join-Path $directory '.foundation-provision-seal.pending'
 $stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$owned=$true
 $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
 # Re-read and verify the newly written public bytes before publishing. No JS
 # is executed and no private readiness is claimed by this builder.
 $parsed=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Get-M03FoundationPhysicalPath $temporary -File)))
 $null=Assert-M03FoundationPublicRuntimeSeal -RepositoryRoot $repo -Seal $parsed -SelectedNodeExecutable $seal.node.path
 if(Test-Path -LiteralPath $destination){[IO.File]::Replace($temporary,(Get-M03FoundationPhysicalPath $destination -File),[NullString]::Value)}else{[IO.File]::Move($temporary,$destination)}
 $owned=$false
 [ordered]@{status='foundation_public_seal_built';version=2;windowId=$seal.windowId;projectFiles=$seal.files.Count;runtimeFiles=$seal.zod.files.Count;privateRead=$false;networkRequests=0;nodeExecuted=$false;finalBindingReady=($null -ne $seal.packetSha256)}|ConvertTo-Json -Compress
 exit 0
}catch{Write-Output 'M03_FOUNDATION_PUBLIC_SEAL_BLOCKED';exit 1}finally{
 if($null -ne $stream){$stream.Dispose()}
 if($owned -and $null -ne $temporary){try{[IO.File]::Delete($temporary)}catch{}}
}
