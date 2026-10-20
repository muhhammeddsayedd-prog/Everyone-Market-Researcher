[CmdletBinding()]
param([ValidateSet('Management','Writer','ApifyRead','All')][string]$Kind='All')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$success=$false
$created=[Collections.Generic.List[string]]::new()
$secret=$null
$stream=$null
$leaseStream=$null
try {
 $directory=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
 $cursor=$directory
 while($null -ne $cursor){
  $entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
  if(-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
  $parent=[IO.Directory]::GetParent($cursor)
  $cursor=if($null -eq $parent){$null}else{$parent.FullName}
 }
 $kinds=if($Kind -ceq 'All'){@('Management','Writer','ApifyRead')}else{@($Kind)}
 foreach($item in $kinds){
  $stem='emr-m03-acceptance-'+$item.ToLowerInvariant()
  foreach($suffix in @('.dpapi','.lease.json')){
   if(Test-Path -LiteralPath (Join-Path $directory ($stem+$suffix))){throw 'blocked'}
  }
 }
 foreach($item in $kinds){
  $prompt=switch -CaseSensitive ($item){
   'Management' {'EXISTING muhhammedsayed n8n management API key, approved bounded M03 dev A-D batch'}
   'Writer' {'EXISTING emr-dev n8n_writer password, zmotjsbzhzjvpelxvxlf session5432, approved M03 runtime only'}
   'ApifyRead' {'Same-owner Apify token with Actor runs / Datasets / Key-value stores READ only, approved bounded original-run verification'}
  }
  $secret=Read-Host $prompt -AsSecureString
  if($secret.Length -eq 0 -or $secret.Length -gt 4096){throw 'blocked'}
  $cipher=ConvertFrom-SecureString -SecureString $secret
  $stem='emr-m03-acceptance-'+$item.ToLowerInvariant()
  $handoff=Join-Path $directory ($stem+'.dpapi')
  $lease=Join-Path $directory ($stem+'.lease.json')
  $stream=[IO.File]::Open($handoff,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $created.Add($handoff)
  $bytes=[Text.Encoding]::ASCII.GetBytes($cipher)
  $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
  $now=[DateTimeOffset]::UtcNow
  $metadata=[ordered]@{
   version=1
   windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
   purpose=('m03_approved_dev_acceptance_'+$item.ToLowerInvariant())
   approvedHead='f42930f90c2de43c84f61ad6d966d0ee6074d70e'
   approvedPacketSha256='009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712'
   kind=$item
   createdAt=$now.ToString('o')
   expiresAt=$now.AddHours(2).ToString('o')
  }
  $leaseStream=[IO.File]::Open($lease,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $created.Add($lease)
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($metadata|ConvertTo-Json -Compress))
  $leaseStream.Write($bytes,0,$bytes.Length);$leaseStream.Flush($true);$leaseStream.Dispose();$leaseStream=$null
  [Array]::Clear($bytes,0,$bytes.Length);$bytes=$null
  $secret.Dispose();$secret=$null;$cipher=$null
 }
 $success=$true
} catch {
 # Hidden input, DPAPI data, exception text and child environments never escape.
} finally {
 if($null -ne $stream){$stream.Dispose()}
 if($null -ne $leaseStream){$leaseStream.Dispose()}
 if($null -ne $secret){$secret.Dispose()}
 $secret=$null;$cipher=$null
 if(-not $success){
  # Only exact files successfully created by this invocation, never existing files.
  foreach($path in $created){try{[IO.File]::Delete($path)}catch{}}
 }
}
if(-not $success){Write-Output 'M03_ACCEPTANCE_HANDOFF_BLOCKED';exit 1}
Write-Output ('M03_ACCEPTANCE_HANDOFF_READY: '+$Kind+'.')
Write-Output 'Close this PowerShell window; keep the saved originals. Send no values or file contents.'
exit 0
