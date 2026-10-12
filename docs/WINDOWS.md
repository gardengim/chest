# Windows testing (PowerShell, x64)

Install Git, Node.js LTS, Rustup, Microsoft C++ Build Tools (Desktop development with
C++, including Windows SDK), and WebView2. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

```powershell
winget install --exact --id Git.Git
winget install --exact --id OpenJS.NodeJS.LTS
winget install --exact --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --exact --id Microsoft.EdgeWebView2Runtime
winget install --exact --id Rustlang.Rustup
```

Finish installations and restart Windows if requested. Open a new PowerShell window.
Run each block in order; stop if a command fails. No execution-policy change is needed
when using npm.cmd/npx.cmd.

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustup component add clippy
New-Item -ItemType Directory -Force "$env:USERPROFILE\Projects" | Out-Null
Set-Location "$env:USERPROFILE\Projects"
git clone https://github.com/gardengim/chest.git
Set-Location chest
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
npx.cmd playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Browser installation failed" }
npm.cmd run verify 2>&1 | Tee-Object -FilePath .\windows-verify.log
if ($LASTEXITCODE -ne 0) { throw "Verification failed; see windows-verify.log" }
```

For an existing clone, use `git pull --ff-only` instead of cloning; preserve local changes.

Start the desktop development app with its own test profile:

```powershell
$env:CHEST_TEST_PROFILE = "$env:LOCALAPPDATA\Chest-TestProfiles\windows-dev"
npm.cmd run tauri -- dev
```

Confirm **Chest — Test profile** in the title. Create an instance, restart, install,
check Log, folders, keyboard navigation, menus and recovery. Configure Chest's own
Microsoft app registration for real sign-in/gameplay; development offline debugging is
available separately. Close Chest and stop the dev command before the next block.

Build/run the release executable without installers or private signing keys:

```powershell
npm.cmd run tauri -- build --no-bundle
if ($LASTEXITCODE -ne 0) { throw "Release build failed" }
$env:CHEST_TEST_PROFILE = "$env:LOCALAPPDATA\Chest-TestProfiles\windows-release"
Start-Process -FilePath ".\src-tauri\target\release\chest.exe" -Wait
```

Release gameplay requires authentication. Test profiles deliberately block app replacement;
real update acceptance uses a separate installed copy/OS user/VM. Profiles are not process
sandboxes: choose disposable external folders and sign out before removing a profile.
See [test profiles](TEST-PROFILES.md) and [acceptance record](ACCEPTANCE.md).

Capture evidence from the project directory:

```powershell
git rev-parse HEAD | Out-File .\windows-environment.txt
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture | Out-File .\windows-environment.txt -Append
rustc -vV | Out-File .\windows-environment.txt -Append
node --version | Out-File .\windows-environment.txt -Append
Get-FileHash .\src-tauri\target\release\chest.exe -Algorithm SHA256 | Out-File .\windows-environment.txt -Append
Remove-Item Env:\CHEST_TEST_PROFILE -ErrorAction SilentlyContinue
```

Report the commit, OS, verify log and sanitized errors. Do not upload credentials or
private keys. Installer, gameplay, authentication and update acceptance are separate
from browser/compilation checks.
