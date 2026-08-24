# Weekly Gradebook

A local, standalone desktop app for tracking student grades week by week.
Everything is stored on your own machine — nothing is uploaded anywhere.

## Features

- Add students by name, add weeks (label + date)
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

### Windows: "Cannot create symbolic link" error

If `npm run dist:win` fails with `ERROR: Cannot create symbolic link ... A
required privilege is not held by the client`, electron-builder is trying to
download and unpack a macOS code-signing cache tool (`winCodeSign`) that
contains symlinks, and your Windows account isn't allowed to create them.
The `dist:win` script already sets `CSC_IDENTITY_AUTO_DISCOVERY=false` to
skip that download entirely — make sure you've run `npm install` after
pulling this change so `cross-env` is installed. If you still hit it (e.g.
from a leftover cache), either:

- Enable Developer Mode: Settings → Privacy & security → For developers →
  Developer Mode, then re-run the build, or
- Run your terminal as Administrator once for the build.

## Where your data lives

Grades are stored in a small JSON file in your OS's standard app-data
folder (e.g. `%APPDATA%/weekly-gradebook` on Windows, `~/Library/Application
Support/weekly-gradebook` on macOS, `~/.config/weekly-gradebook` on Linux),
managed by `electron-store`. Back up that file if you want a copy of your
gradebook data.
