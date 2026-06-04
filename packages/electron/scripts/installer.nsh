!include LogicLib.nsh

!macro customInit
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /im OpenChamber.exe'
!macroend

!macro customInstall
  ; Cleanup handled by electron-builder's built-in uninstallOldVersion.
  ; No custom logic needed — files are extracted after old version is removed.
!macroend
