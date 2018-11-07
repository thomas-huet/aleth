# Aleth

Simple flashcard app

## Features

- No installation
- Simple to use
- Works on all devices
- Works offline
- Synchronization between devices

If you want more features, look at [Anki](https://apps.ankiweb.net/) or [Mnemosyne](https://mnemosyne-proj.org/).

## Contributing

The source is covered by the AGPL v3.
I welcome all contributions.

The goal of this project is to make a flashcard app as frictionless as possible that can be used by a 6-year-old.
All new features must be compatible with that goal.
If you want to add features that go the opposite way, you are welcome to fork this project.

You can clear the cache and sign out of Google Drive by visiting the [reset](https://thomas-huet.github.io/aleth/reset) url.
Synchronization uses the [Application Data folder](https://developers.google.com/drive/api/v3/appdata) in Google Drive.

## Spaced repetition algorithm

If you know the answer, the interval is multiplied by `K`, if not it is divided by `K`.
Currently `K = 2`.
