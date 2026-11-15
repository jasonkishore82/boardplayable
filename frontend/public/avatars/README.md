# Profile pictures

Put image files here and they show up in the app. No code changes are needed. Until a picture exists, the app shows
the person's initials on a coloured square.

## Computer opponents

Save one picture per bot in `bots/`, named after the bot's id. The app tries `.png`, then `.webp`, then `.jpg`.

| Bot | File |
| --- | --- |
| Easy Bot | `bots/easy.png` |
| Medium Bot | `bots/medium.png` |
| jkw Chess Bot | `bots/jkw.png` |
| Maia 1100 | `bots/maia-1100.png` |
| Maia 1500 | `bots/maia-1500.png` |
| Maia 1900 | `bots/maia-1900.png` |

Pictures show as a curved square. Use a portrait or head-and-shoulders image, at least 256 x 256 pixels, with the face
in the upper half: the picture is cropped to a square and the top is kept. A large preview of the highlighted bot is
drawn at 112 pixels.

Anything in this folder is public, so only add pictures you have the right to use.

## Players

A player's own picture comes from their profile (`avatar_url`). Uploading one from the profile page is not built yet.
