# Called only inside the sealed bounded consumer while its provisioning lock is held.
# The explicit ID correction changes metadata, never the existing saved token.
function Assert-M03PendingKeys($Value,[string[]]$Expected) {
 if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($Expected|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}
}
function Get-M03PendingFile([string]$Path,[int]$Maximum=65536) {
 $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
 while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
 $entry=Get-Item -LiteralPath $absolute -Force
 if($entry.PSIsContainer -or $entry.Length -gt $Maximum){throw 'blocked'}
 return $absolute
}
function Assert-M03PendingMetadata($Value,[string]$Audience,[string]$SourceCommitSha) {
 Assert-M03PendingKeys $Value @('version','windowId','purpose','audience','sourceCommitSha','credentialId','createdAt')
 if($Value.version -isnot [int] -or $Value.version -ne 1 -or $Value.windowId -isnot [string] -or $Value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $Value.purpose -isnot [string] -or $Value.purpose -cne 'pending_inactive_m03_runtime_delivery' -or $Value.audience -isnot [string] -or $Value.audience -cne $Audience -or $Value.sourceCommitSha -isnot [string] -or $Value.sourceCommitSha -cne $SourceCommitSha -or $Value.credentialId -isnot [string] -or $Value.createdAt -isnot [string] -or $Value.createdAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,7}(?:Z|\+00:00)$'){throw 'blocked'}
 $created=[DateTimeOffset]::Parse($Value.createdAt,[Globalization.CultureInfo]::InvariantCulture)
 if($created -gt [DateTimeOffset]::UtcNow){throw 'blocked'}
}
function Assert-M03PendingPreMachineJournal([string]$Path) {
 $lines=@([IO.File]::ReadAllLines((Get-M03PendingFile $Path)))
 if($lines.Count -lt 1 -or $lines.Count -gt 251){throw 'blocked'}
 $header=ConvertFrom-Json -InputObject $lines[0] -ErrorAction Stop
 Assert-M03PendingKeys $header @('version','windowId','kind')
 if($header.version -isnot [int] -or $header.version -ne 1 -or $header.windowId -isnot [string] -or $header.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $header.kind -isnot [string] -or $header.kind -cne 'inactive_binding_intents'){throw 'blocked'}
 $intents=@{};$acks=@{};$ids=@{}
 for($index=1;$index -lt $lines.Count;$index++){
  $row=ConvertFrom-Json -InputObject $lines[$index] -ErrorAction Stop
  if($row.event -isnot [string] -or $row.event -cnotin @('tag_intent','tag_ack')){throw 'blocked'}
  Assert-M03PendingKeys $row $(if($row.event -ceq 'tag_intent'){@('event','name')}else{@('event','name','id','created')})
  if($row.name -isnot [string] -or $row.name -cnotmatch '^(?:env:dev|layer:(?:collector|ai|ops|sub)|platform:(?:vimeo|instagram|instagram_stories|youtube|linkedin|linkedin_employees|website_work_page|news))$'){throw 'blocked'}
  if($row.event -ceq 'tag_intent'){
   if($intents.ContainsKey($row.name) -or $acks.ContainsKey($row.name)){throw 'blocked'};$intents[$row.name]=$true
  }else{
   if($row.id -isnot [string] -or $row.id -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $row.created -isnot [bool] -or ($row.created -and -not $intents.ContainsKey($row.name)) -or $acks.ContainsKey($row.name) -or $ids.ContainsKey($row.id)){throw 'blocked'}
   $acks[$row.name]=$row.id;$ids[$row.id]=$true
  }
 }
}
function Assert-M03PendingTransitionReceipt([string]$Path,$Metadata,[string]$Audience,[string]$SourceCommitSha) {
 $lines=@([IO.File]::ReadAllLines((Get-M03PendingFile $Path 16384)))
 if($lines.Count -ne 2){throw 'blocked'}
 $intent=ConvertFrom-Json -InputObject $lines[0] -ErrorAction Stop;$commit=ConvertFrom-Json -InputObject $lines[1] -ErrorAction Stop
 Assert-M03PendingKeys $intent @('version','windowId','event','oldMetadata','credentialId')
 Assert-M03PendingKeys $commit @('version','windowId','event','credentialId')
 foreach($row in @($intent,$commit)){if($row.version -isnot [int] -or $row.version -ne 1 -or $row.windowId -isnot [string] -or $row.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $row.credentialId -isnot [string] -or $row.credentialId -cne 'EmrM03Machine19'){throw 'blocked'}}
 if($intent.event -isnot [string] -or $intent.event -cne 'credential_id_transition_intent' -or $commit.event -isnot [string] -or $commit.event -cne 'credential_id_transition_committed'){throw 'blocked'}
 Assert-M03PendingMetadata $intent.oldMetadata $Audience $SourceCommitSha
 if($intent.oldMetadata.credentialId -cne 'EmrFoundationMachine19' -or $Metadata.credentialId -cne 'EmrM03Machine19'){throw 'blocked'}
 foreach($field in @('version','windowId','purpose','audience','sourceCommitSha','createdAt')){if($intent.oldMetadata.$field -cne $Metadata.$field){throw 'blocked'}}
}
function Update-M03PendingCredentialIdentity([string]$Directory,$Metadata,[string]$Journal) {
 Assert-M03PendingPreMachineJournal $Journal
 $meta=Join-Path $Directory 'pending-runtime.json';$receipt=Join-Path $Directory 'pending-runtime.credential-id-transition.jsonl';$next=Join-Path $Directory 'pending-runtime.credential-id-next.json';$lock=Join-Path $Directory 'pending-runtime.credential-id-transition.lock'
 foreach($path in @($receipt,$next,$lock)){if(Test-Path -LiteralPath $path){throw 'blocked'}}
 $lockStream=$null;$receiptStream=$null;$nextStream=$null;$committed=$false
 try{
  $lockStream=[IO.File]::Open($lock,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  # Preserve all seven old metadata fields. A crash leaves the intent and lock
  # for explicit reconciliation; neither token nor ciphertext is ever copied.
  $intent=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';event='credential_id_transition_intent';oldMetadata=$Metadata;credentialId='EmrM03Machine19'}
  $receiptStream=[IO.File]::Open($receipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $payload=[Text.UTF8Encoding]::new($false).GetBytes(($intent|ConvertTo-Json -Depth 4 -Compress)+[Environment]::NewLine);$receiptStream.Write($payload,0,$payload.Length);$receiptStream.Flush($true)
  $replacement=[ordered]@{version=$Metadata.version;windowId=$Metadata.windowId;purpose=$Metadata.purpose;audience=$Metadata.audience;sourceCommitSha=$Metadata.sourceCommitSha;credentialId='EmrM03Machine19';createdAt=$Metadata.createdAt}
  $nextStream=[IO.File]::Open($next,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $payload=[Text.UTF8Encoding]::new($false).GetBytes(($replacement|ConvertTo-Json -Compress));$nextStream.Write($payload,0,$payload.Length);$nextStream.Flush($true);$nextStream.Dispose();$nextStream=$null
  [IO.File]::Replace((Get-M03PendingFile $next 16384),(Get-M03PendingFile $meta 16384),[NullString]::Value)
  $commit=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';event='credential_id_transition_committed';credentialId='EmrM03Machine19'}
  $payload=[Text.UTF8Encoding]::new($false).GetBytes(($commit|ConvertTo-Json -Compress)+[Environment]::NewLine);$receiptStream.Write($payload,0,$payload.Length);$receiptStream.Flush($true);$receiptStream.Dispose();$receiptStream=$null
  $current=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Get-M03PendingFile $meta 16384)))
  Assert-M03PendingTransitionReceipt $receipt $current $Metadata.audience $Metadata.sourceCommitSha
  $committed=$true
 }finally{
  if($null -ne $nextStream){$nextStream.Dispose()};if($null -ne $receiptStream){$receiptStream.Dispose()};if($null -ne $lockStream){$lockStream.Dispose()}
  if($committed){[IO.File]::Delete($lock)}
 }
}
function Get-M03FoundationPendingMachine {
 param([Parameter(Mandatory=$true)][string]$Audience,[Parameter(Mandatory=$true)][string]$SourceCommitSha,[Parameter(Mandatory=$true)][string]$BindingJournalPath)
 $secret=$null;$rng=$null;$bytes=$null;$stream=$null;$metaStream=$null;$created=$false;$metaCreated=$false;$success=$false
 try{
  if($Audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $SourceCommitSha -cnotmatch '^[a-f0-9]{40}$'){throw 'blocked'}
  $sourceDirectory=[IO.Path]::GetDirectoryName($MyInvocation.MyCommand.ScriptBlock.File)
  $repo=[IO.Path]::GetFullPath((Join-Path $sourceDirectory '..\..\..'))
  $expectedJournal=[IO.Path]::GetFullPath((Join-Path $repo 'scripts/n8n/out/foundation/binding-intents.jsonl'))
  if(-not [IO.Path]::GetFullPath($BindingJournalPath).Equals($expectedJournal,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $journal=Get-M03PendingFile $BindingJournalPath
  $base=[IO.Path]::GetFullPath($env:LOCALAPPDATA)
  $directory=[IO.Path]::GetFullPath((Join-Path $base 'Everyone-Market-Radar-Private\foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9'))
  if(-not $directory.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $cursor=$directory
  while($null -ne $cursor){if(Test-Path -LiteralPath $cursor){$e=Get-Item -LiteralPath $cursor -Force;if(-not $e.PSIsContainer -or ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  $null=[IO.Directory]::CreateDirectory($directory)
  $file=Join-Path $directory 'machine.dpapi';$meta=Join-Path $directory 'pending-runtime.json';$transition=Join-Path $directory 'pending-runtime.credential-id-transition.jsonl'
  foreach($temporary in @('pending-runtime.credential-id-next.json','pending-runtime.credential-id-transition.lock')){if(Test-Path -LiteralPath (Join-Path $directory $temporary)){throw 'blocked'}}
  if((Test-Path -LiteralPath $file) -or (Test-Path -LiteralPath $meta)){
   $null=Get-M03PendingFile $file 16384;$null=Get-M03PendingFile $meta 16384
   $m=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($meta));Assert-M03PendingMetadata $m $Audience $SourceCommitSha
   if($m.credentialId -ceq 'EmrFoundationMachine19'){
    if(Test-Path -LiteralPath $transition){throw 'blocked'}
    Update-M03PendingCredentialIdentity $directory $m $journal
    $m=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Get-M03PendingFile $meta 16384)));Assert-M03PendingMetadata $m $Audience $SourceCommitSha
   }
   if($m.credentialId -cne 'EmrM03Machine19'){throw 'blocked'}
   if(Test-Path -LiteralPath $transition){Assert-M03PendingTransitionReceipt $transition $m $Audience $SourceCommitSha}
   # No saved token is decrypted before its transition is fully reconciled.
   $secret=ConvertTo-SecureString -String ([IO.File]::ReadAllText($file).Trim())
  }else{
   if(Test-Path -LiteralPath $transition){throw 'blocked'}
   Assert-M03PendingPreMachineJournal $journal
   $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($bytes)
   $plain=[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_');$secret=ConvertTo-SecureString -String $plain -AsPlainText -Force;$plain=$null
   $cipher=ConvertFrom-SecureString -SecureString $secret
   $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$created=$true;$payload=[Text.Encoding]::ASCII.GetBytes($cipher);$stream.Write($payload,0,$payload.Length);$stream.Flush($true)
   $metadata=[ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';purpose='pending_inactive_m03_runtime_delivery';audience=$Audience;sourceCommitSha=$SourceCommitSha;credentialId='EmrM03Machine19';createdAt=[DateTimeOffset]::UtcNow.ToString('o')}
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
