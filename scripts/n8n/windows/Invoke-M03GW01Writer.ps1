[CmdletBinding()]
param([ValidateSet('Verify','Inspect','Bind','Close')][string]$Mode='Inspect',[switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$required=@('scripts/n8n/gw01-writer.mjs','scripts/n8n/windows/Invoke-M03GW01Writer.ps1','scripts/n8n/windows/New-M03GW01Handoff.ps1','scripts/n8n/gw01-reviewed-preview.json','scripts/n8n/gw01-local-privacy.json','scripts/n8n/gw01-cloud-privacy.json','scripts/seed/check-tls.mjs','scripts/seed/certs/supabase-root-2021.crt','scripts/seed/certs/supabase-root-2021.json')
$stream=$null;$secure=$null;$bstr=[IntPtr]::Zero;$password=$null;$bytes=$null;$privateInput=$null
$receipt=[ordered]@{version=1;mode=$Mode;status='preflight_blocked';privateRead=$false;rootChildClosed=$true;handoffRetained=$true;nativeExit=$null;result=$null}
function Safe-Path([string]$Path){$absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute;while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}};return $absolute}
function Json([string]$Relative){$file=Safe-Path (Join-Path $repo $Relative);if((Get-Item -LiteralPath $file).Length -gt 65536){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file))}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function Run([string[]]$Arguments,[string]$InputText,[int]$Timeout){
  $start=$null;$child=$null;$started=$false;$closed=$true;$buffer=$null;$memory=$null;$stdout=$null;$stderr=$null;$text=$null;$native=$null
  try{
    $quoted=foreach($a in $Arguments){if($a -match '["\r\n\x00]' -or $a.EndsWith('\')){throw 'blocked'};'"'+$a+'"'}
    $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.Arguments=$quoted -join ' ';$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
    foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
    $child=New-Object Diagnostics.Process;$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear()
    $buffer=New-Object byte[] 16384;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    if($null -ne $InputText){$child.StandardInput.Write($InputText)};$child.StandardInput.Close();$InputText=$null
    if(-not $child.WaitForExit($Timeout)){throw 'blocked'};$closed=$true;$native=$child.ExitCode
    if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
    $text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
  }catch{$text=$null}finally{
    $InputText=$null;if($null -ne $start){$start.EnvironmentVariables.Clear()}
    if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};$child.Dispose()}
    if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  };return [PSCustomObject]@{closed=$closed;native=$native;text=$text}
}
try{
  $null=Safe-Path $repo;$preview=Json 'scripts/n8n/gw01-reviewed-preview.json';Keys $preview @('audience','commitSha','deploymentId','projectId','branch')
  if($preview.projectId -cne 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' -or $preview.branch -cne 'm03-n8n-foundation' -or $preview.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $preview.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $preview.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{16,80}$'){throw 'blocked'}
  $local=Json 'scripts/n8n/gw01-local-privacy.json';foreach($name in @('passed','consumerReviewed','canaryTestsPassed')){if($local.$name -isnot [bool] -or -not $local.$name){throw 'blocked'}}
  $cloud=Json 'scripts/n8n/gw01-cloud-privacy.json';if($cloud.version -ne 1 -or $cloud.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $cloud.instanceHost -cne 'muhhammedsayed.app.n8n.cloud'){throw 'blocked'};foreach($name in @('passed','credentialCanaryVerified','executionCanaryVerified','exportCanaryVerified','logCanaryVerified')){if($cloud.$name -isnot [bool] -or -not $cloud.$name){throw 'blocked'}}
  $seal=Json 'scripts/n8n/gw01-writer-seal.json';Keys $seal @('version','files');if($seal.version -ne 1){throw 'blocked'};Keys $seal.files $required
  foreach($relative in $required){$hash=$seal.files.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Safe-Path (Join-Path $repo $relative)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw 'blocked'}}
  $node=(Get-Command node.exe -CommandType Application).Source;$runner=Safe-Path (Join-Path $repo 'scripts/n8n/gw01-writer.mjs');$tls=Safe-Path (Join-Path $repo 'scripts/seed/check-tls.mjs')
  $handoff=Safe-Path (Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-gw01-dev-writer.dpapi');if((Get-Item -LiteralPath $handoff).Length -gt 65536){throw 'blocked'}
}catch{Write-Output 'GW01_WRITER_PREFLIGHT_BLOCKED. No private read, decryption, child or connection.';exit 1}
if($CheckOnly){Write-Output 'GW01_WRITER_CHECK_ONLY_READY. No private read, decryption, child or connection.';exit 0}
try{
  $t=Run @($tls) $null 15000;$receipt.rootChildClosed=$t.closed;if(-not $t.closed -or $t.native -ne 0){throw 'blocked'};$v=ConvertFrom-Json -InputObject $t.text
  if($v.status -cne 'verified' -or $v.phase -cne 'tls_handshake' -or $v.code -cne 'TLS_VERIFIED' -or $v.environment -cne 'dev' -or $v.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $v.host -cne 'aws-1-eu-central-1.pooler.supabase.com' -or $v.port -ne 5432){throw 'blocked'}
  foreach($name in @('rejectUnauthorized','exactServerName','scopedCaVerified','socketsClosed')){if($v.$name -isnot [bool] -or -not $v.$name){throw 'blocked'}};foreach($name in @('startupMessageSent','authenticationAttempted')){if($v.$name -isnot [bool] -or $v.$name){throw 'blocked'}}
  $stream=[IO.File]::Open((Safe-Path $handoff),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$receipt.privateRead=$true;$bytes=New-Object byte[] ([int]$stream.Length);if($stream.Read($bytes,0,$bytes.Length) -ne $bytes.Length){throw 'blocked'}
  $secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($bytes).Trim());[Array]::Clear($bytes,0,$bytes.Length);$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secure.Dispose();$secure=$null
  $privateInput=@{mode=$Mode;password=$password;preview=$preview}|ConvertTo-Json -Depth 5 -Compress;$r=Run @($runner,'--private-writer') $privateInput 60000;$privateInput=$null;$receipt.rootChildClosed=$r.closed;$receipt.nativeExit=$r.native
  if(-not $r.closed -or $null -eq $r.text -or $r.text.Contains($password)){throw 'blocked'};$v=ConvertFrom-Json -InputObject $r.text
  Keys $v @('version','status','mode','code','identity','authorizationDenials','window','connectionClosed')
  if($v.version -ne 1 -or $v.mode -cne $Mode -or $v.status -cnotin @('complete','stopped_reconcile') -or $v.connectionClosed -isnot [bool] -or $v.authorizationDenials -lt 0 -or $v.authorizationDenials -gt 4 -or ($null -ne $v.code -and $v.code -cnotmatch '^GW01_WRITER_(INPUT|IDENTITY|AUTHORIZATION|CONTROL|CONNECTION|CLEANUP)$')){throw 'blocked'}
  if($null -ne $v.identity){Keys $v.identity @('currentUser','sessionUser','database','projectRef');if($v.identity.currentUser -cne 'n8n_writer' -or $v.identity.sessionUser -cne 'n8n_writer' -or $v.identity.database -cne 'postgres' -or $v.identity.projectRef -cne 'zmotjsbzhzjvpelxvxlf'){throw 'blocked'}}
  if($null -ne $v.window){Keys $v.window @('id','startsAt','expiresAt','closed','totalAdmitted','boundAudience','boundCommitSha','boundDeploymentId');if($v.window.id -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780' -or $v.window.closed -isnot [bool] -or $v.window.totalAdmitted -lt 0 -or $v.window.totalAdmitted -gt 100){throw 'blocked'}}
  if($v.status -ceq 'complete' -and ($null -eq $v.identity -or $null -eq $v.window -or -not $v.connectionClosed -or $r.native -ne 0 -or ($Mode -ceq 'Verify' -and $v.authorizationDenials -ne 4) -or ($Mode -ceq 'Close' -and -not $v.window.closed))){throw 'blocked'}
  $receipt.result=$v;$receipt.status=$v.status
}catch{$receipt.status='stopped_reconcile'}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secure){$secure.Dispose()};$password=$null;$privateInput=$null;$v=$null;$r=$null;if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)};if($null -ne $stream){$stream.Dispose()}
}
Write-Output ($receipt|ConvertTo-Json -Depth 6 -Compress)
if($receipt.status -cne 'complete' -or -not $receipt.rootChildClosed){exit 1};exit 0
