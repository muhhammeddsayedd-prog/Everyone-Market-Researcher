[CmdletBinding()]
param(
 [ValidateSet('Initialize','Status','Update')][string]$Action='Initialize',
 [ValidateSet('Admin','Management','Writer','ApifyRead','All')][string]$Kind='All'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
try{
 . (Join-Path $PSScriptRoot 'Dev-CredentialStore.ps1')
 if($Action -ceq 'Status'){
  Write-Output ((Get-M03DevCredentialStatus)|ConvertTo-Json -Depth 5 -Compress)
 }else{
  Initialize-M03DevCredentials -Action $Action -Kind $Kind
  Write-Output 'M03_DEV_ACCESS_READY'
  Write-Output 'Current-user-encrypted dev originals retained outside Git. Authentication is not tested. Close this PowerShell window; send no values or file contents.'
 }
 exit 0
}catch{
 # Never expose secure input, ciphertext, environment data or native exceptions.
 Write-Output 'M03_DEV_ACCESS_BLOCKED'
 exit 1
}
