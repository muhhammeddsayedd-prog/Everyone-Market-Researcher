function Get-M03FoundationPendingMachine {
 param([Parameter(Mandatory=$true)][string]$Audience,[Parameter(Mandatory=$true)][string]$SourceCommitSha)
 $secret=$null;$rng=$null;$bytes=$null;$stream=$null;$metaStream=$null;$created=$false;$metaCreated=$false;$success=$false
 try{
  if($Audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $SourceCommitSha -cnotmatch '^[a-f0-9]{40}$'){throw 'blocked'}
  $base=[IO.Path]::GetFullPath($env:LOCALAPPDATA)
  $directory=[IO.Path]::GetFullPath((Join-Path $base 'Everyone-Market-Radar-Private\foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9'))
  if(-not $directory.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $cursor=$directory
  while($null -ne $cursor){if(Test-Path -LiteralPath $cursor){$e=Get-Item -LiteralPath $cursor -Force;if(-not $e.PSIsContainer -or ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  $null=[IO.Directory]::CreateDirectory($directory)
  $file=Join-Path $directory 'machine.dpapi';$meta=Join-Path $directory 'pending-runtime.json'
  if((Test-Path -LiteralPath $file) -or (Test-Path -LiteralPath $meta)){
   foreach($p in @($file,$meta)){$e=Get-Item -LiteralPath $p -Force;if($e.PSIsContainer -or ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $e.Length -gt 16384){throw 'blocked'}}
   $m=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($meta))
   if(@(Compare-Object -CaseSensitive @('version','windowId','purpose','audience','sourceCommitSha','credentialId','createdAt'|Sort-Object) @($m.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $m.version -isnot [int] -or $m.version -ne 1 -or $m.windowId -isnot [string] -or $m.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $m.purpose -isnot [string] -or $m.purpose -cne 'pending_inactive_m03_runtime_delivery' -or $m.audience -isnot [string] -or $m.audience -cne $Audience -or $m.sourceCommitSha -isnot [string] -or $m.sourceCommitSha -cne $SourceCommitSha -or $m.credentialId -isnot [string] -or $m.credentialId -cne 'EmrFoundationMachine19' -or $m.createdAt -isnot [string]){throw 'blocked'}
   $secret=ConvertTo-SecureString -String ([IO.File]::ReadAllText($file).Trim())
  }else{
   $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($bytes)
   $plain=[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_');$secret=ConvertTo-SecureString -String $plain -AsPlainText -Force;$plain=$null
   $cipher=ConvertFrom-SecureString -SecureString $secret
   $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$created=$true;$payload=[Text.Encoding]::ASCII.GetBytes($cipher);$stream.Write($payload,0,$payload.Length);$stream.Flush($true)
   $metadata=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';purpose='pending_inactive_m03_runtime_delivery';audience=$Audience;sourceCommitSha=$SourceCommitSha;credentialId='EmrFoundationMachine19';createdAt=[DateTimeOffset]::UtcNow.ToString('o')}
   $metaStream=[IO.File]::Open($meta,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$metaCreated=$true;$payload=[Text.Encoding]::UTF8.GetBytes(($metadata|ConvertTo-Json -Compress));$metaStream.Write($payload,0,$payload.Length);$metaStream.Flush($true)
  }
  $success=$true
 }catch{
  # No secret, ciphertext, length/hash or raw exception is emitted.
 }finally{
  if($null -ne $stream){$stream.Dispose()};if($null -ne $metaStream){$metaStream.Dispose()};if($null -ne $rng){$rng.Dispose()};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)};$plain=$null;$cipher=$null;$payload=$null
  if(-not $success){if($null -ne $secret){$secret.Dispose()};if($created){try{[IO.File]::Delete($file)}catch{}};if($metaCreated){try{[IO.File]::Delete($meta)}catch{}}}
 }
 if(-not $success){throw 'FOUNDATION_MACHINE_PRIVATE_STORE_BLOCKED'}
 return $secret
}
