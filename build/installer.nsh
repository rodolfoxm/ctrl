; ctrl installer extras (electron-builder nsis.include).
; A page that offers "start with Windows" (checked) and creates the same scheduled task the app's
; Settings > Geral switch creates. The installer was just approved as administrator, so this works where
; an antivirus may still be restricting the app itself. Uninstalling removes the ctrl's tasks, except
; when the old version is removed as part of an update.
!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var ctrlStartupCheckbox
  Var ctrlStartupState
!endif

; Inserted among the installer pages, where the Modern UI macros already exist (this file itself is
; read earlier, and also for the uninstaller, so the functions live inside the macro).
!macro customPageAfterChangeDir
  Page custom ctrlStartupPage ctrlStartupLeave

  Function ctrlStartupPage
    !insertmacro MUI_HEADER_TEXT "Inicialização" "O ctrl pode abrir sozinho quando você entra no Windows."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 40u "Ele abre escondido na bandeja, ao lado do relógio, para a Sentinela, o Core e o Modo ao vivo funcionarem sem você abrir o app. Dá para mudar depois em Configurações › Geral."
    Pop $0
    ${NSD_CreateCheckbox} 0 48u 100% 12u "Iniciar o ctrl com o Windows"
    Pop $ctrlStartupCheckbox
    ${NSD_Check} $ctrlStartupCheckbox
    nsDialogs::Show
  FunctionEnd

  Function ctrlStartupLeave
    ${NSD_GetState} $ctrlStartupCheckbox $ctrlStartupState
  FunctionEnd
!macroend

!macro customInstall
  ; Silent installs and updates skip the page: the state is empty and an existing task is kept as is.
  ${If} $ctrlStartupState == ${BST_CHECKED}
    nsExec::Exec `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Register-ScheduledTask -TaskPath '\ctrl\' -TaskName 'app-logon' -Action (New-ScheduledTaskAction -Execute '$INSTDIR\ctrl.exe' -Argument '--minimized') -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $$env:USERNAME) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)) -Principal (New-ScheduledTaskPrincipal -UserId $$env:USERNAME -LogonType Interactive -RunLevel Highest) -Description 'Abre o ctrl minimizado ao fazer logon.' -Force | Out-Null"`
    Pop $0
  ${EndIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::Exec `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-ScheduledTask -TaskPath '\ctrl\' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$$false"`
    Pop $0
  ${endIf}
!macroend
