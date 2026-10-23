# Persistent CurrentUser DPAPI originals outside Git; bounded consumers receive
# only their selected disposable ciphertext copies. This adapter never decrypts.
Set-StrictMode -Version Latest

function Get-M03DevCredentialRoot {
 if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'M03_DEV_ACCESS_PATH_BLOCKED'}
 return [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private\secrets\dev'))
}
function Assert-M03DevCipherFraming([byte[]]$Bytes) {
 # ConvertFrom-SecureString on Windows without -Key emits a CurrentUser DPAPI
 # hexadecimal blob. Framing is not decryption or credential authentication.
 if($Bytes.Length -lt 80 -or $Bytes.Length -gt 65536){throw 'M03_DEV_ACCESS_CIPHER_BLOCKED'}
 $text=[Text.Encoding]::ASCII.GetString($Bytes)
 try{if($text -notmatch '\A01000000d08c9ddf0115d1118c7a00c04fc297eb[0-9a-f]+\z' -or ($text.Length % 2) -ne 0){throw 'M03_DEV_ACCESS_CIPHER_BLOCKED'}}finally{$text=$null}
}
function Assert-M03DevPlainPath([string]$Path,[bool]$Directory) {
 $entry=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
 if($entry.PSIsContainer -ne $Directory -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M03_DEV_ACCESS_PATH_BLOCKED'}
 if(-not $Directory -and $null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink'){throw 'M03_DEV_ACCESS_PATH_BLOCKED'}
 $ancestor=if($entry.PSIsContainer){$entry.Parent}else{$entry.Directory}
 while($null -ne $ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M03_DEV_ACCESS_PATH_BLOCKED'};$ancestor=$ancestor.Parent}
 return $entry
}
function Set-M03DevPrivateAcl([string]$Path,[bool]$Directory) {
 $null=Assert-M03DevPlainPath $Path $Directory
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
 $acl=if($Directory){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}
 $acl.SetAccessRuleProtection($true,$false);$acl.SetOwner($sid)
 $inheritance=if($Directory){[Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
 foreach($identity in @($sid,$system)){
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($identity,[Security.AccessControl.FileSystemRights]::FullControl,$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  $null=$acl.AddAccessRule($rule)
 }
 # Set only the locally constructed owner/DACL; do not request the unrelated
 # SACL/SeSecurityPrivilege section that PowerShell Set-Acl may request.
 if($Directory){[IO.Directory]::SetAccessControl($Path,$acl)}else{[IO.File]::SetAccessControl($Path,$acl)}
}
function Assert-M03DevPrivateAcl([string]$Path,[bool]$Directory) {
 $null=Assert-M03DevPlainPath $Path $Directory
 $acl=Get-Acl -LiteralPath $Path -ErrorAction Stop
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid -or $rules.Count -ne 2){throw 'M03_DEV_ACCESS_ACL_BLOCKED'}
 foreach($rule in $rules){if($rule.IsInherited -or $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.IdentityReference.Value -cnotin @($sid,'S-1-5-18') -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'M03_DEV_ACCESS_ACL_BLOCKED'}}
 if(@($rules|ForEach-Object{$_.IdentityReference.Value}|Select-Object -Unique).Count -ne 2){throw 'M03_DEV_ACCESS_ACL_BLOCKED'}
}
function Get-M03DevCredentialSpec {
 param([ValidateSet('Admin','Management','Writer','ApifyRead')][string]$Kind,[ValidateSet('ProjectVerifiedContinuation','StartupReplacement','PhaseA')][string]$AdminMode='ProjectVerifiedContinuation')
 $root=Get-M03DevCredentialRoot
 $relative=if($Kind -ceq 'Admin'){'admin\database.dpapi'}else{'runtime\'+$Kind.ToLowerInvariant()+'.dpapi'}
 $stem=if($Kind -ceq 'Admin'){'emr-m03-foundation-dev-migration-password'}else{'emr-m03-acceptance-'+$Kind.ToLowerInvariant()}
 return [pscustomobject]@{Kind=$Kind;Source=(Join-Path $root $relative);Cipher=(Join-Path $env:LOCALAPPDATA ('Temp\'+$stem+'.dpapi'));Lease=(Join-Path $env:LOCALAPPDATA ('Temp\'+$stem+'.lease.json'));AdminMode=$AdminMode}
}
function Get-M03DevCredentialLease {
 param($Spec)
 $now=[DateTimeOffset]::UtcNow
 if($Spec.Kind -ceq 'Admin'){
  return [ordered]@{version=1;environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';purpose=$(if($Spec.AdminMode -ceq 'ProjectVerifiedContinuation'){'m03-foundation-project-verified-continuation-dev:20275b22-b7fe-4737-a9a4-c50c2feadb74'}else{'m03-foundation-phase-a-dev'});approvalSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';createdAt=$now.UtcDateTime.ToString('o');expiresAt=$now.UtcDateTime.AddHours(2).ToString('o')}
 }
 return [ordered]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';purpose=('m03_approved_dev_acceptance_'+$Spec.Kind.ToLowerInvariant());approvedHead='f42930f90c2de43c84f61ad6d966d0ee6074d70e';approvedPacketSha256='009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712';kind=$Spec.Kind;createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o')}
}
function Assert-M03DevApprovedTemporaryPair {
 param($Spec)
 $cipher=Assert-M03DevPlainPath $Spec.Cipher $false
 $lease=Assert-M03DevPlainPath $Spec.Lease $false
 if($cipher.Length -lt 2 -or $cipher.Length -gt 65536 -or $lease.Length -gt 4096){throw 'M03_DEV_ACCESS_TEMPORARY_BLOCKED'}
 $value=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($Spec.Lease)) -ErrorAction Stop
 $expected=Get-M03DevCredentialLease $Spec
 if(@(Compare-Object -CaseSensitive @($expected.Keys|Sort-Object) @($value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'M03_DEV_ACCESS_TEMPORARY_BLOCKED'}
 foreach($key in $expected.Keys){if($key -cnotin @('createdAt','expiresAt') -and $value.$key -cne $expected[$key]){throw 'M03_DEV_ACCESS_TEMPORARY_BLOCKED'}}
 $created=[DateTimeOffset]::MinValue;$expires=[DateTimeOffset]::MinValue
 if(-not [DateTimeOffset]::TryParse($value.createdAt,[ref]$created) -or -not [DateTimeOffset]::TryParse($value.expiresAt,[ref]$expires) -or $created -gt [DateTimeOffset]::UtcNow.AddMinutes(1) -or $expires -le $created -or $expires -gt $created.AddHours(2).AddSeconds(1)){throw 'M03_DEV_ACCESS_TEMPORARY_BLOCKED'}
 # Delivery-lease expiry is not provider expiry or a new owner authorization gate.
}
function Write-M03DevPrivateFile {
 param([string]$Path,[byte[]]$Bytes,[switch]$Replace)
 $parent=[IO.Path]::GetDirectoryName($Path);Assert-M03DevPrivateAcl $parent $true
 $scratch=Join-Path $parent ('.emr-write-'+[Guid]::NewGuid().ToString('N')+'.tmp')
 $stream=$null;$created=$false
 try{
  $stream=[IO.File]::Open($scratch,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$created=$true
  Set-M03DevPrivateAcl $scratch $false
  $stream.Write($Bytes,0,$Bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
  if($Replace){Assert-M03DevPrivateAcl $Path $false;[IO.File]::Replace($scratch,$Path,[NullString]::Value)}else{[IO.File]::Move($scratch,$Path)}
  $created=$false;Assert-M03DevPrivateAcl $Path $false
 }finally{if($null -ne $stream){$stream.Dispose()};if($created){[IO.File]::Delete($scratch)}}
}
function Initialize-M03DevPrivateDirectory {
 $root=Get-M03DevCredentialRoot
 $local=Assert-M03DevPlainPath $env:LOCALAPPDATA $true
 $cursor=$local.FullName
 foreach($part in @('Everyone-Market-Radar-Private','secrets','dev')){
  $cursor=Join-Path $cursor $part
  if(-not (Test-Path -LiteralPath $cursor)){[IO.Directory]::CreateDirectory($cursor)|Out-Null}
  $null=Assert-M03DevPlainPath $cursor $true
 }
 Set-M03DevPrivateAcl $root $true
 foreach($part in @('admin','runtime')){
  $directory=Join-Path $root $part
  if(-not (Test-Path -LiteralPath $directory)){[IO.Directory]::CreateDirectory($directory)|Out-Null}
  Set-M03DevPrivateAcl $directory $true
 }
 return $root
}
function Get-M03DevCredentialStatus {
 $root=Get-M03DevCredentialRoot;$entries=@();$missing=@()
 if(Test-Path -LiteralPath $root){Assert-M03DevPrivateAcl $root $true}
 foreach($kind in @('Admin','Management','Writer','ApifyRead')){
  $spec=Get-M03DevCredentialSpec $kind;$present=Test-Path -LiteralPath $spec.Source
  if($present){Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($spec.Source)) $true;Assert-M03DevPrivateAcl $spec.Source $false}
  $entries+=,[ordered]@{kind=$kind;present=[bool]$present}
  if(-not $present){$missing+=$kind}
 }
 return [ordered]@{status=$(if($missing.Count -eq 0){'ready'}else{'missing_inputs'});persistent=$true;authenticationTested=$false;entries=$entries;missing=@($missing)}
}
function Initialize-M03DevCredentials {
 param([ValidateSet('Initialize','Update')][string]$Action='Initialize',[ValidateSet('Admin','Management','Writer','ApifyRead','All')][string]$Kind='All')
 $root=Initialize-M03DevPrivateDirectory
 $lockPath=Join-Path $root 'store.operation.lock';$lock=$null;$secret=$null;$bytes=$null;$cipher=$null
 try{
  $lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);Set-M03DevPrivateAcl $lockPath $false
  $kinds=if($Kind -ceq 'All'){@('Admin','Management','Writer','ApifyRead')}else{@($Kind)}
  foreach($item in $kinds){
   $spec=Get-M03DevCredentialSpec $item;$exists=Test-Path -LiteralPath $spec.Source
   if($exists){Assert-M03DevPrivateAcl $spec.Source $false;if($Action -ceq 'Initialize'){continue}}
   if(-not $exists -and $Action -ceq 'Initialize' -and (Test-Path -LiteralPath $spec.Cipher) -and (Test-Path -LiteralPath $spec.Lease)){
    Assert-M03DevApprovedTemporaryPair $spec
    $bytes=[IO.File]::ReadAllBytes($spec.Cipher)
   }else{
    $prompt=switch -CaseSensitive ($item){
     'Admin' {'EXISTING emr-dev postgres password, zmotjsbzhzjvpelxvxlf; dev administration only'}
     'Management' {'EXISTING muhhammedsayed n8n management API key; approved Market Radar dev only'}
     'Writer' {'EXISTING emr-dev n8n_writer password, zmotjsbzhzjvpelxvxlf session5432; restricted runtime only'}
     'ApifyRead' {'EXISTING same-owner Apify READ token: Actor runs, Datasets and Key-value stores; no actor-start token'}
    }
    $secret=Read-Host $prompt -AsSecureString
    if($secret.Length -eq 0 -or $secret.Length -gt 4096){throw 'M03_DEV_ACCESS_INPUT_BLOCKED'}
    $cipher=ConvertFrom-SecureString -SecureString $secret -ErrorAction Stop
    $bytes=[Text.Encoding]::ASCII.GetBytes($cipher)
   }
   Assert-M03DevCipherFraming $bytes
   Write-M03DevPrivateFile -Path $spec.Source -Bytes $bytes -Replace:$exists
   [Array]::Clear($bytes,0,$bytes.Length);$bytes=$null;$cipher=$null
   if($null -ne $secret){$secret.Dispose();$secret=$null}
  }
 }finally{if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)};if($null -ne $secret){$secret.Dispose()};$cipher=$null;if($null -ne $lock){$lock.Dispose()}}
}
function Ensure-M03DevRuntimeHandoff {
 param([ValidateSet('Admin','Management','Writer','ApifyRead')][string]$Kind,[ValidateSet('ProjectVerifiedContinuation','StartupReplacement','PhaseA')][string]$AdminMode='ProjectVerifiedContinuation',[IO.FileStream]$CoordinatorLock=$null)
 $spec=Get-M03DevCredentialSpec -Kind $Kind -AdminMode $AdminMode
 if(-not (Test-Path -LiteralPath $spec.Source)){throw ('M03_DEV_CREDENTIAL_MISSING_'+$Kind.ToUpperInvariant())}
 $root=Get-M03DevCredentialRoot;Assert-M03DevPrivateAcl $root $true;Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($spec.Source)) $true;Assert-M03DevPrivateAcl $spec.Source $false
 $null=Assert-M03DevPlainPath (Join-Path $env:LOCALAPPDATA 'Temp') $true
 $lock=$null;$bytes=$null;$leaseBytes=$null;$created=@();$stream=$null
 try{
  $lock=[IO.File]::Open((Join-Path $root 'store.operation.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $hasCipher=Test-Path -LiteralPath $spec.Cipher;$hasLease=Test-Path -LiteralPath $spec.Lease
  if($hasCipher -or $hasLease){
   if(-not $hasCipher -or -not $hasLease){throw 'M03_DEV_ACCESS_TEMPORARY_AMBIGUOUS'}
   Assert-M03DevApprovedTemporaryPair $spec
   $bytes=[IO.File]::ReadAllBytes($spec.Source);Assert-M03DevCipherFraming $bytes;$copy=[IO.File]::ReadAllBytes($spec.Cipher)
   try{
    $same=$bytes.Length -eq $copy.Length
    if($same){for($i=0;$i -lt $bytes.Length;$i++){if($bytes[$i] -ne $copy[$i]){$same=$false;break}}}
    if(-not $same){throw 'M03_DEV_ACCESS_TEMPORARY_AMBIGUOUS'}
   }finally{[Array]::Clear($copy,0,$copy.Length);$copy=$null}
   $value=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($spec.Lease)) -ErrorAction Stop
   if([DateTimeOffset]::Parse($value.expiresAt) -lt [DateTimeOffset]::UtcNow.AddMinutes(90)){
    # Only the current held parent mutex may refresh an exact matching copy.
    # Its OS share mode prevents replacement while the coordinator owns it.
    $parent=Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-acceptance-parent.operation.lock'
    if($null -eq $CoordinatorLock -or -not $CoordinatorLock.CanWrite -or $CoordinatorLock.SafeFileHandle.IsClosed -or [IO.Path]::GetFullPath($CoordinatorLock.Name) -cne [IO.Path]::GetFullPath($parent)){throw 'M03_DEV_ACCESS_TEMPORARY_AMBIGUOUS'}
    $parentEntry=Assert-M03DevPlainPath $parent $false
    if($parentEntry.Length -gt 1024){throw 'M03_DEV_ACCESS_TEMPORARY_AMBIGUOUS'}
    $parentReader=$null;$parentStream=$null
    try{
     $parentStream=[IO.File]::Open($parent,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
     $parentReader=[IO.StreamReader]::new($parentStream)
     $owner=ConvertFrom-Json -InputObject ($parentReader.ReadToEnd()) -ErrorAction Stop
    }finally{if($null -ne $parentReader){$parentReader.Dispose()}elseif($null -ne $parentStream){$parentStream.Dispose()}}
    if($owner.kind -cne 'm03_clock_admission_parent' -or $owner.version -ne 1 -or $owner.processId -ne $PID -or $owner.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74'){throw 'M03_DEV_ACCESS_TEMPORARY_AMBIGUOUS'}
    $leaseBytes=[Text.UTF8Encoding]::new($false).GetBytes(((Get-M03DevCredentialLease $spec)|ConvertTo-Json -Compress))
    $stream=[IO.File]::Open($spec.Lease,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $stream.Write($leaseBytes,0,$leaseBytes.Length);$stream.SetLength($leaseBytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
   }
   return
  }
  $bytes=[IO.File]::ReadAllBytes($spec.Source)
  Assert-M03DevCipherFraming $bytes
  $leaseBytes=[Text.UTF8Encoding]::new($false).GetBytes(((Get-M03DevCredentialLease $spec)|ConvertTo-Json -Compress))
  foreach($record in @(@{Path=$spec.Cipher;Bytes=$bytes},@{Path=$spec.Lease;Bytes=$leaseBytes})){
   $stream=[IO.File]::Open($record.Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$created+=,$record.Path
   Set-M03DevPrivateAcl $record.Path $false
   $stream.Write($record.Bytes,0,$record.Bytes.Length);$stream.Flush($true);$stream.Dispose();$stream=$null
  }
  $created=@()
 }finally{
  if($null -ne $stream){$stream.Dispose()};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)};if($null -ne $leaseBytes){[Array]::Clear($leaseBytes,0,$leaseBytes.Length)}
  foreach($path in $created){[IO.File]::Delete($path)}
  if($null -ne $lock){$lock.Dispose()}
 }
}
