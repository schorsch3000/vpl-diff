# VPL Diff

A static website to compare **C64 palette files** in VICE `.vpl` format, side by side.

- **Server palettes** live in [`palettes/`](palettes/) as `.vpl` files, listed in
  [`palettes/index.json`](palettes/index.json) (a JSON array of filenames).
- **Your palettes** are uploaded in the browser, parsed client-side, and stored in
  `localStorage`. Nothing is sent to any server.
- Palettes are shown as a table: **one row per color index**, one column per palette,
  so the same color slot always sits next to its counterpart in every other palette.
- Colors that differ from a chosen **reference** palette are outlined, and a footer
  counts how many colors differ per palette. (The dither nibble is ignored.)

There is **no active server component** — just HTML, client-side JS, CSS, and the
`.vpl` files. You can also export any palette (server or uploaded) back to `.vpl`.


## Adding server palettes

1. Drop a valid VICE `.vpl` file into `palettes/`.
2. Regenerate the manifest (requires `jq`):

   ```sh
   ./palettes/build-index.sh
   ```

   This rewrites `palettes/index.json` with every `.vpl` in the directory,
   sorted. (You can still edit `index.json` by hand instead.)

## The VICE `.vpl` format

Plain text. `#` starts a comment; blank lines are ignored. Each colour line is
whitespace-separated **hexadecimal** bytes:

```
# Red Green Blue Dither
00 00 00 0   # Black
ff ff ff f   # White
```

The parser reads the first three values as the RGB triplet and keeps the optional
fourth (dither) nibble for round-tripping on export.

## Deployment (GitHub Pages)

The repo ships a workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
that publishes the site to GitHub Pages on every push to `main`/`master`.

One-time setup: in the repository, go to **Settings → Pages → Build and deployment**
and set **Source** to **GitHub Actions**. After the next push the site is served at
`https://<user>.github.io/<repo>/`. All asset paths are relative, so it works under
that project subpath unchanged.

## License

[MIT](LICENSE) © Dirk Heilig
