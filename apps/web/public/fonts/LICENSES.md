# Font licences

| Family | Files | Licence | In this repository? |
|---|---|---|---|
| IBM Plex Sans Arabic | `IBMPlexSansArabic-{Regular,Medium,SemiBold}.woff2` from npm `@ibm/plex-sans-arabic@1.1.0` | SIL Open Font License 1.1 (`IBMPlexSansArabic-OFL.txt`) | Yes |
| General Sans | `GeneralSans-{Medium,Semibold,BoldItalic}.woff2` from Fontshare | ITF Free Font License 2.0 | **No** |

## Why General Sans is not committed

This repository is public. The ITF Free Font License (Fontshare) allows the font to be self-hosted
for our own website or app. It forbids making the files available through a "repository" or
"publicly accessible servers" other than the font serving our own app. Committing the `.woff2`
files here would redistribute them, so `apps/web/.gitignore` excludes `GeneralSans-*`.

How the app behaves:

- **Files present:** `next.config.ts` detects `GeneralSans-Medium.woff2` at build time. The app
  then sets `data-brand-font="1"` and uses the brand stack from `styles/tokens.css`.
- **Files absent:** the app uses the system UI stack. It never requests the missing files, so
  nothing 404s. IBM Plex Sans Arabic still renders Arabic text.

The owner's decision on how to provide General Sans for Vercel builds is recorded in
`milestones/M09-web-app-foundation/PROGRESS.md`. Options include a build-time download from
Fontshare, or a private store.
