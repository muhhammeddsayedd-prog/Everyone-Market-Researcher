# OWNER-ONLY. Do not run through automation to retry the policy-blocked actual
# dependency inspection. No network, DPAPI read, decryption or private request.
[CmdletBinding()]
param([switch]$AdvanceReviewedConfig)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$temporary=$null;$ownedTemporary=$false;$child=$null;$started=$false;$closed=$true;$start=$null;$buffer=$null;$memory=$null
# BEGIN REVIEWED PUBLIC SOURCES
$reviewed=ConvertFrom-Json -InputObject @'
{"scripts/n8n/gw01-gateway-transport.mjs":"e0f13d337662d003263fd3b465f40ee06b5d0c183b5f38b927c83eacba8ba565","scripts/n8n/gw01-gateway-logs.mjs":"d82eddabbe7b7593cda0c0bcba662d9434d6f0f0cf9eb8280914e0c5869d9b76","scripts/n8n/gw01-trial.mjs":"0d061eabed43651df145df1f82d403d6396d807db6451ce0622367d86dc859f5","packages/shared/src/n8n-worker-contracts.ts":"1195db341df1dafc1bbddbd9939ab779780aecd181903dcd4e402c46d382e21b","packages/shared/package.json":"35abc94942e944707bbbeace169ebeeb659122624a401056281b049956a7f3a8","pnpm-lock.yaml":"41a3cd4479dc1c8e0c504f466b4a7d27536d3f4b5eeaeec13123022a0fb212ef","scripts/n8n/windows/New-M03GW01Handoff.ps1":"e7e46ba59016a5ee5fc0ff8ee9cf5d886f9e244824b00a97179b204d87ea6ab4","scripts/n8n/windows/Invoke-M03GW01Gateway.ps1":"29e3f169b173ee9fb99569efa4bc4c49b14e34256eda031bc17423d8bcbad407"}
'@
# END REVIEWED PUBLIC SOURCES
# Only this reviewed runtime-phase/Duplicate2 revision of two public source files is
# permitted. A packet cannot nominate source paths or a former source revision.
# BEGIN REVIEWED PREVIOUS SOURCES
$previousSources=@{
 'scripts/n8n/gw01-gateway-transport.mjs'='738502f9ba6268ba255751700ccf738f0d828effc35001d5fd60b9fbb8e2df3f'
 'scripts/n8n/windows/Invoke-M03GW01Gateway.ps1'='4f650df56fe689ad5fac4220d9e4663c03185bf7d08ec1e6a9b95bfb478a6297'
}
# END REVIEWED PREVIOUS SOURCES
function Safe-Path([string]$Path){
  $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
  while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  return $absolute
}
function File([string]$Path){$file=Safe-Path $Path;if((Get-Item -LiteralPath $file -Force).PSIsContainer){throw 'blocked'};return $file}
function Hash([string]$Path){return (Get-FileHash -LiteralPath (File $Path) -Algorithm SHA256).Hash.ToLowerInvariant()}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function Json([string]$Relative){$file=File (Join-Path $repo $Relative);if((Get-Item -LiteralPath $file).Length -gt 524288){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file)) -ErrorAction Stop}
function Write-New([string]$Path,[byte[]]$Data){
  $stream=$null;try{$stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($Data,0,$Data.Length);$stream.Flush($true)}finally{if($null -ne $stream){$stream.Dispose()}}
}
function Run-Public([string]$Executable,[string]$Arguments,[string]$InputText){
  $p=$null;$s=$null;$didStart=$false;$didClose=$true;$data=$null;$output=$null
  try{
    $s=New-Object Diagnostics.ProcessStartInfo;$s.FileName=$Executable;$s.Arguments=$Arguments;$s.WorkingDirectory=$repo;$s.UseShellExecute=$false;$s.CreateNoWindow=$true;$s.RedirectStandardInput=$true;$s.RedirectStandardOutput=$true;$s.RedirectStandardError=$true;$s.EnvironmentVariables.Clear()
    foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$s.EnvironmentVariables[$name]=$v}}
    $p=New-Object Diagnostics.Process;$p.StartInfo=$s;$didStart=$p.Start();if(-not $didStart){throw 'blocked'};$didClose=$false;$s.EnvironmentVariables.Clear();$data=New-Object byte[] 65536;$output=[IO.MemoryStream]::new([byte[]]$data,$true)
    $outTask=$p.StandardOutput.BaseStream.CopyToAsync($output);$errTask=$p.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null);if($null -ne $InputText){$p.StandardInput.Write($InputText)};$p.StandardInput.Close()
    if(-not $p.WaitForExit(30000)){throw 'blocked'};$didClose=$true
    if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($outTask,$errTask)).Wait(5000) -or $p.ExitCode -ne 0){throw 'blocked'}
    return ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($data,0,[int]$output.Position))
  }finally{
    if($null -ne $s){$s.EnvironmentVariables.Clear()};if($null -ne $p){if($didStart -and -not $didClose){try{if(-not $p.WaitForExit(0)){$p.Kill()};$didClose=$p.WaitForExit(5000)}catch{$didClose=$false}};$p.Dispose()};if($null -ne $output){$output.Dispose()};if($null -ne $data){[Array]::Clear($data,0,$data.Length)}
  }
}
function Assert-PublicTarget{
  $node=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $transport=File (Join-Path $repo 'scripts/n8n/gw01-gateway-transport.mjs')
  $publicInput=@{mode='Probe';preview=$preview;request=@{version=1;requestId='296bd1b9-d356-45d1-9c83-ecc348709dab';operation='identity.read';args=[PSCustomObject]@{}};kind='preflight';authorization='synthetic';fault='none';secrets=@{protection='GW01_PUBLIC_PREFLIGHT_PLACEHOLDER_PROTECTION'}}|ConvertTo-Json -Depth 7 -Compress
  $ready=Run-Public $node ('"'+$transport+'" --check-public') $publicInput;Keys $ready @('version','status','networkRequests','privateRead')
  if($ready.version -ne 1 -or $ready.status -cne 'public_ready' -or $ready.networkRequests -ne 0 -or $ready.privateRead -isnot [bool] -or $ready.privateRead){throw 'blocked'}
}
function Runtime-Files([string]$Root,[string]$Start,[string[]]$Extensions){
  $result=@('package.json');$queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue((Safe-Path $Start));$count=0
  while($queue.Count -gt 0){foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
    $count++;if($count -gt 10000 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    if(-not $entry.FullName.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
    if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}elseif($entry.Extension -cin $Extensions){$result+=$entry.FullName.Substring($Root.Length+1).Replace('\','/');if($result.Count -gt 2000){throw 'blocked'}}
  }}
  return $result
}
try{
  $null=Safe-Path $repo
  foreach($pin in $reviewed.PSObject.Properties){if((Hash (Join-Path $repo $pin.Name)) -cne $pin.Value){throw 'blocked'}}
  $consumer=File (Join-Path $repo 'scripts/n8n/windows/Invoke-M03GW01Gateway.ps1')
  # Parse only the already hash-pinned source. Never evaluate AST/source text.
  $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($consumer,[ref]$tokens,[ref]$errors)
  if($errors.Count -ne 0){throw 'blocked'}
  $assignments=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Operator -eq 'Equals' -and $n.Left -is [Management.Automation.Language.VariableExpressionAst] -and $n.Left.VariablePath.UserPath -ceq 'required'},$true))
  if($assignments.Count -ne 1){throw 'blocked'}
  $required=@($assignments[0].Right.FindAll({param($n) $n -is [Management.Automation.Language.StringConstantExpressionAst]},$true)|ForEach-Object {$_.Value})
  if($required.Count -ne 12 -or @($required|Sort-Object -Unique).Count -ne $required.Count){throw 'blocked'}
  foreach($relative in $required){if($relative -cnotmatch '^[A-Za-z0-9_-][A-Za-z0-9_./-]*$' -or $relative.Contains('..')){throw 'blocked'}}
  $preview=Json 'scripts/n8n/gw01-reviewed-preview.json';Keys $preview @('version','projectId','teamId','branch','commitSha','deploymentId','audience','target','protection','routeDisabledVerified')
  if($preview.version -ne 1 -or $preview.projectId -cne 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' -or $preview.teamId -cne 'team_gboXPxTevpCOZuaA8eY9PmR1' -or $preview.branch -cne 'm03-n8n-foundation' -or $preview.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $preview.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{16,80}$' -or $preview.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $preview.target -cne 'preview' -or $preview.protection -cne 'all_except_custom_domains' -or $preview.routeDisabledVerified -isnot [bool]){throw 'blocked'}
  $config=Json 'scripts/n8n/gw01-trial-config.json';Keys $config @('windowId','audiences')
  if($config.windowId -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780' -or $config.audiences -isnot [Array] -or $config.audiences.Count -lt 1 -or $config.audiences.Count -gt 10 -or @($config.audiences|Sort-Object -Unique).Count -ne $config.audiences.Count){throw 'blocked'}
  foreach($audience in $config.audiences){if($audience -isnot [string] -or $audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$'){throw 'blocked'}}
  $local=Json 'scripts/n8n/gw01-local-privacy.json';if($local.version -ne 1){throw 'blocked'}
  foreach($name in @('passed','consumerReviewed','canaryTestsPassed')){if($local.$name -isnot [bool] -or -not $local.$name){throw 'blocked'}}
  $cloud=Json 'scripts/n8n/gw01-cloud-privacy.json'
  if($cloud.version -ne 1 -or $cloud.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $cloud.instanceHost -cne 'muhhammedsayed.app.n8n.cloud' -or $cloud.ownedWorkflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$'){throw 'blocked'}
  foreach($name in @('credentialCanaryVerified','executionCanaryVerified','exportCanaryVerified')){if($cloud.$name -isnot [bool] -or -not $cloud.$name){throw 'blocked'}}
  foreach($name in @('passed','logCanaryVerified')){if($cloud.$name -isnot [bool]){throw 'blocked'}}
  # Same physical runtime/one permitted junction rules as the pinned consumer.
  $zodRelative='node_modules/.pnpm/zod@4.6.7/node_modules/zod';$zodRoot=Safe-Path (Join-Path $repo $zodRelative)
  $sharedModules=Safe-Path (Join-Path $repo 'packages/shared/node_modules');$link=Get-Item -LiteralPath (Join-Path $sharedModules 'zod') -Force
  if(($link.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or @($link.Target).Count -ne 1){throw 'blocked'}
  $resolved=[IO.Path]::GetFullPath([IO.Path]::Combine($sharedModules,@($link.Target)[0]));if(-not $resolved.Equals($zodRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  if((Json ($zodRelative+'/package.json')).version -cne '4.6.7'){throw 'blocked'}
  $zodFiles=@(Runtime-Files $zodRoot $zodRoot @('.js'));foreach($relative in $zodFiles){$required+=($zodRelative+'/'+$relative)}
  if($required.Count -gt 2000){throw 'blocked'}
  $vercelRoot=Safe-Path (Join-Path $env:APPDATA 'npm/node_modules/vercel');$vercelPackage=File (Join-Path $vercelRoot 'package.json')
  if((ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($vercelPackage))).version -cne '56.5.0'){throw 'blocked'}
  $vercelRequired=@(Runtime-Files $vercelRoot (Join-Path $vercelRoot 'dist') @('.js','.mjs','.cjs','.json','.wasm'))
  if('dist/index.js' -cnotin $vercelRequired){throw 'blocked'}
  $files=[ordered]@{};foreach($relative in @($required|Sort-Object)){$files[$relative]=Hash (Join-Path $repo $relative)}
  $vercelFiles=[ordered]@{};foreach($relative in @($vercelRequired|Sort-Object)){$vercelFiles[$relative]=Hash (Join-Path $vercelRoot $relative)}
  $sealText=([ordered]@{version=1;files=$files;vercelFiles=$vercelFiles}|ConvertTo-Json -Depth 4 -Compress)+[Environment]::NewLine
  $sealDirectory=Safe-Path (Join-Path $repo 'scripts/n8n');$sealPath=Join-Path $sealDirectory 'gw01-gateway-seal.json'
  if(Test-Path -LiteralPath $sealPath){if([IO.File]::ReadAllText((File $sealPath)) -cne $sealText){
    if(-not $AdvanceReviewedConfig){throw 'blocked'}
    $transition=Json 'scripts/n8n/gw01-gateway-transition.json';Keys $transition @('version','windowId','previousSealSha256','newFiles')
    $publicPaths=@('scripts/n8n/gw01-reviewed-preview.json','scripts/n8n/gw01-cloud-privacy.json');Keys $transition.newFiles $publicPaths
    if($transition.version -isnot [int] -or $transition.version -ne 1 -or $transition.windowId -cne $config.windowId -or $transition.previousSealSha256 -isnot [string] -or $transition.previousSealSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Hash $sealPath) -cne $transition.previousSealSha256){throw 'blocked'}
    foreach($relative in $publicPaths){if($transition.newFiles.$relative -isnot [string] -or $transition.newFiles.$relative -cne $files[$relative]){throw 'blocked'}}
    $old=Json 'scripts/n8n/gw01-gateway-seal.json';Keys $old @('version','files','vercelFiles');if($old.version -isnot [int] -or $old.version -ne 1){throw 'blocked'};Keys $old.files @($files.Keys);Keys $old.vercelFiles @($vercelFiles.Keys)
    foreach($map in @($old.files,$old.vercelFiles)){foreach($pin in $map.PSObject.Properties){if($pin.Value -isnot [string] -or $pin.Value -cnotmatch '^[a-f0-9]{64}$'){throw 'blocked'}}}
    $changed=@();$sourceUpdates=@()
    foreach($relative in $files.Keys){if($old.files.$relative -cne $files[$relative]){
      if($relative -cin $publicPaths){$changed+=@($relative)}elseif($previousSources.ContainsKey($relative) -and $old.files.$relative -ceq $previousSources[$relative] -and $files[$relative] -ceq $reviewed.$relative){$sourceUpdates+=@($relative)}else{throw 'blocked'}
    }}
    foreach($relative in $vercelFiles.Keys){if($old.vercelFiles.$relative -cne $vercelFiles[$relative]){throw 'blocked'}}
    # Validate the old runtime/source baseline before executing any runtime JS.
    # Then check the exact registered target before creating archives or seals.
    Assert-PublicTarget
    $out=Safe-Path (Join-Path $repo 'scripts/n8n/out/gw01');$archiveDirectory=Join-Path $out 'public-seals';if(-not (Test-Path -LiteralPath $archiveDirectory)){$null=[IO.Directory]::CreateDirectory($archiveDirectory)};$archiveDirectory=Safe-Path $archiveDirectory
    $archive=Join-Path $archiveDirectory ($transition.previousSealSha256+'.json');$record=Join-Path $archiveDirectory ($transition.previousSealSha256+'.transition.json');$backup=Join-Path $archiveDirectory ($transition.previousSealSha256+'.replace-backup.json')
    foreach($path in @($archive,$record,$backup)){if(Test-Path -LiteralPath $path){throw 'blocked'}}
    $oldBytes=[IO.File]::ReadAllBytes((File $sealPath));if((Hash $sealPath) -cne $transition.previousSealSha256){throw 'blocked'};Write-New $archive $oldBytes
    $temporary=Join-Path $sealDirectory '.gw01-gateway-seal.pending';Write-New $temporary ([Text.UTF8Encoding]::new($false).GetBytes($sealText));$ownedTemporary=$true;$nextHash=Hash $temporary
    $recordText=[ordered]@{version=1;kind='reviewed_transition_intent';windowId=$config.windowId;previousSealSha256=$transition.previousSealSha256;nextSealSha256=$nextHash;changedFiles=@($changed);sourceUpdates=@($sourceUpdates)}|ConvertTo-Json -Depth 4 -Compress
    Write-New $record ([Text.UTF8Encoding]::new($false).GetBytes($recordText))
    if((Hash $sealPath) -cne $transition.previousSealSha256 -or (Hash $archive) -cne $transition.previousSealSha256){throw 'blocked'}
    [IO.File]::Replace($temporary,(File $sealPath),$backup);$ownedTemporary=$false
    if((Hash $sealPath) -cne $nextHash -or (Hash $backup) -cne $transition.previousSealSha256){throw 'blocked'}
  }else{Assert-PublicTarget}}else{
    Assert-PublicTarget
    $temporary=Join-Path $sealDirectory '.gw01-gateway-seal.pending';$stream=$null
    try{$stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$ownedTemporary=$true;$bytes=[Text.UTF8Encoding]::new($false).GetBytes($sealText);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{if($null -ne $stream){$stream.Dispose()}}
    $null=Safe-Path $sealDirectory;[IO.File]::Move($temporary,$sealPath);$ownedTemporary=$false
  }
}catch{Write-Output 'PUBLIC_SEAL_BLOCKED';exit 1}finally{if($ownedTemporary -and $null -ne $temporary){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
Write-Output 'PUBLIC_SEAL_READY'
try{
  # Only the existing public CheckOnly may run. No Mode Request/private flags.
  $powerShell=File (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe')
  $v=Run-Public $powerShell ('-NoProfile -NonInteractive -File "'+$consumer+'" -Mode Probe -CheckOnly') $null;Keys $v @('version','mode','status','privateRead','rootChildClosed','nativeExit','handoffsRetained','result')
  if($v.version -ne 1 -or $v.mode -cne 'Probe' -or $v.status -cne 'check_only_ready' -or $v.privateRead -isnot [bool] -or $v.privateRead -or $v.rootChildClosed -isnot [bool] -or -not $v.rootChildClosed -or $null -ne $v.nativeExit -or $v.handoffsRetained -isnot [bool] -or -not $v.handoffsRetained -or $null -ne $v.result){throw 'blocked'}
  Write-Output ($v|ConvertTo-Json -Depth 3 -Compress)
}catch{Write-Output 'PUBLIC_CHECK_ONLY_BLOCKED';exit 1}finally{
  if($null -ne $start){$start.EnvironmentVariables.Clear()}
  if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};$child.Dispose()}
  if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
}
exit 0
