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

## Where your data lives

Grades are stored in a small JSON file in your OS's standard app-data
folder (e.g. `%APPDATA%/weekly-gradebook` on Windows, `~/Library/Application
Support/weekly-gradebook` on macOS, `~/.config/weekly-gradebook` on Linux),
managed by `electron-store`. Back up that file if you want a copy of your
gradebook data.
