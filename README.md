# Weekly Gradebook

A local, standalone desktop app for tracking student grades week by week.
Everything is stored on your own machine — nothing is uploaded anywhere.

## Features

- Add students by name, add weeks (label + date)
- Organize students into class sections (e.g. "Period 1 - Algebra") and
  filter the gradebook by class using the tabs, or view everyone at once
- Enter one or more scores per student per week — the app averages them
  into that week's grade automatically
- See an overall average per student across all weeks entered so far
- All data is saved locally to disk automatically (no manual "save")
- Works completely offline

## Run it in development

```bash
cd gradebook-app
npm install
npm start
```

## Build a standalone installer

```bash
npm run dist:win     # Windows .exe (NSIS installer)
npm run dist:mac      # macOS .dmg
npm run dist:linux    # Linux .AppImage
```

Installers are written to `gradebook-app/release/`. Building for macOS
requires running on a Mac; Windows and Linux builds can generally be made
from any platform electron-builder supports.

### Windows: "Cannot create symbolic link" / winCodeSign errors

`npm run dist:win` used to fail with `ERROR: Cannot create symbolic link ...
A required privilege is not held by the client`, or with a `7za.exe`
extraction failure — both come from electron-builder downloading and
unpacking a code-signing/resource-editing cache tool (`winCodeSign`) that
contains macOS symlinks, which most Windows accounts can't create.

This is now avoided entirely: `build.win.signAndEditExecutable` is set to
`false` in `package.json`, so electron-builder never touches `winCodeSign`
for a Windows build. The trade-off is that the installed app's `.exe` keeps
Electron's default icon (the installer itself, `Weekly Gradebook Setup
*.exe`, still gets the custom icon — that's set by NSIS directly). If you'd
rather have the custom icon on the installed exe too, delete that line from
`package.json` and instead enable Developer Mode (Settings → Privacy &
security → For developers → Developer Mode) or run your terminal as
Administrator before building.

If you still see a winCodeSign error after pulling this fix, delete the
stale cache first: `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.

### App runs but no window appears

If the app launches (visible in Task Manager) but no window shows up, it's
usually a silent crash or a GPU driver issue on some Windows machines. The
app now:

- Renders in software mode (`app.disableHardwareAcceleration()`), which
  sidesteps GPU-driver crashes that otherwise fail silently with no window.
- Writes any startup error to `main-error.log` in the app's data folder
  (see below for the path) and shows it as a popup dialog, instead of
  failing silently.

If it still happens, check that log file and share its contents when
reporting the issue.

## Where your data lives

Grades are stored in a small JSON file in your OS's standard app-data
folder (e.g. `%APPDATA%/weekly-gradebook` on Windows, `~/Library/Application
Support/weekly-gradebook` on macOS, `~/.config/weekly-gradebook` on Linux),
managed by `electron-store`. Back up that file if you want a copy of your
gradebook data.
