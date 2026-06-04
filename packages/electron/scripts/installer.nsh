!include LogicLib.nsh

!macro customInit
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /im OpenChamber.exe'
!macroend

!ifndef BUILD_UNINSTALLER
Function OpenChamberIsExistingInstall
  ClearErrors
  IfFileExists "$INSTDIR\OpenChamber.exe" 0 checkResources
  Push 1
  Return

  checkResources:
  IfFileExists "$INSTDIR\resources\*.*" 0 checkAsar
  Push 1
  Return

  checkAsar:
  IfFileExists "$INSTDIR\resources\app.asar" 0 notExisting
  Push 1
  Return

  notExisting:
  Push 0
FunctionEnd

Function OpenChamberRemoveOldApplicationFiles
  Call OpenChamberIsExistingInstall
  Pop $0
  StrCmp $0 1 0 done

  Delete "$INSTDIR\OpenChamber.exe"
  Delete "$INSTDIR\OpenChamber.VisualElementsManifest.xml"
  Delete "$INSTDIR\chrome_100_percent.pak"
  Delete "$INSTDIR\chrome_200_percent.pak"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\ffmpeg.dll"
  Delete "$INSTDIR\icudtl.dat"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\resources.pak"
  Delete "$INSTDIR\snapshot_blob.bin"
  Delete "$INSTDIR\v8_context_snapshot.bin"
  Delete "$INSTDIR\vk_swiftshader.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\vulkan-1.dll"

  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\swiftshader"

  done:
FunctionEnd
!endif

!macro customInstall
  Call OpenChamberIsExistingInstall
  Pop $0
  StrCmp $0 1 0 done
  DetailPrint "Removing old OpenChamber application files while preserving user data..."
  Call OpenChamberRemoveOldApplicationFiles
  done:
!macroend
