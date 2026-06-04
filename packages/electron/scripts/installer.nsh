!include LogicLib.nsh
!include nsDialogs.nsh

Var OpenChamberCleanUpgradeCheckbox
Var OpenChamberCleanUpgradeChoice

!macro customHeader
  Page custom OpenChamberCleanUpgradePageCreate OpenChamberCleanUpgradePageLeave
!macroend

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

Function OpenChamberCleanUpgradePageCreate
  Call OpenChamberIsExistingInstall
  Pop $0
  StrCmp $0 1 0 skipPage

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "OpenChamber X is already installed in this folder. You can remove old application files before installing this version. User data, settings, sessions, and caches are preserved."
  Pop $0

  ${NSD_CreateCheckbox} 0 42u 100% 12u "Remove old application files before installing (preserves user data)"
  Pop $OpenChamberCleanUpgradeCheckbox
  ${NSD_Check} $OpenChamberCleanUpgradeCheckbox

  nsDialogs::Show
  Return

  skipPage:
  Abort
FunctionEnd

Function OpenChamberCleanUpgradePageLeave
  ${NSD_GetState} $OpenChamberCleanUpgradeCheckbox $OpenChamberCleanUpgradeChoice
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

!macro customInstall
  StrCmp $OpenChamberCleanUpgradeChoice ${BST_CHECKED} 0 done
  DetailPrint "Removing old OpenChamber application files while preserving user data..."
  Call OpenChamberRemoveOldApplicationFiles
  done:
!macroend
