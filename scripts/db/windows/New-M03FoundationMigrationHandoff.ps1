[CmdletBinding()]
param([switch]$PostcheckContinuation,[switch]$RemainingContinuation,[switch]$StartupReplacement,[switch]$ProjectVerifiedContinuation)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
try{
 if(@($PostcheckContinuation,$RemainingContinuation,$StartupReplacement,$ProjectVerifiedContinuation|Where-Object{$_}).Count -gt 1){throw 'blocked'}
 . (Join-Path $PSScriptRoot '..\..\n8n\windows\Dev-CredentialStore.ps1')
 $mode=if($ProjectVerifiedContinuation){'ProjectVerifiedContinuation'}elseif($StartupReplacement){'StartupReplacement'}else{'PhaseA'}
 Ensure-M03DevRuntimeHandoff -Kind Admin -AdminMode $mode
 Write-Output 'M03_FOUNDATION_MIGRATION_ADMIN_READY. Disposable dev-only copy prepared from the persistent Admin entry; original retained. No authentication or database operation performed.'
 exit 0
}catch{
 Write-Output 'M03_FOUNDATION_MIGRATION_HANDOFF_BLOCKED. Use New-M03AcceptanceHandoff.ps1 -Action Status to identify genuinely missing persistent dev inputs; no credential contents printed.'
 exit 1
}
