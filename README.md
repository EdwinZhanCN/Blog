# edwinzhan.space

A notebook. Astro, Markdown, and one WebGL fragment shader.

## Writing

```sh
npm run new -- "A title"                    # → src/content/blog/Notes/a-title.md
npm run new -- "A title" --in Lumilio-Photos  # → filed in an existing series
npm run dev                                 # drafts are visible here, and only here
```

A note needs two things: `title` and `pubDate`. Everything else can stay empty.

| Field         | What it does                                                                 |
| ------------- | ---------------------------------------------------------------------------- |
| `description` | One line under the title and in the index.                                   |
| `order`       | Position inside its series (the folder it lives in).                         |
| `status`      | `sketch` (unfinished on purpose), `inked` (done), `shelved` (project stopped). |
| `draft`       | `true` keeps it out of the built site. It does not have to be finished to be `false`. |
| `heroImage`   | A real image replaces the generated painting.                                |
| `lang`        | Language of the prose, for typography. Defaults to `zh-Hans`.                |

Titles written as `@Series: Title` are shown without the prefix wherever the series is already named.

Obsidian callouts (`> [!note] Title`) and code titles (` ```ts title="file.ts" `) render the same on the site as in the vault. The vault template is `src/content/blog/_templates/Blog-Template.md`.

### Obsidian

Open **`src/content/blog/`** as the vault, not the repo root: no code, no symlinks. Its `.obsidian/` is git-ignored, so on a new machine set Files & links to: Wikilinks off · New link format *Relative path to file* · Attachment folder `./_assets` · Templater template folder `_templates`.

Pictures live next to their series in `_assets/` and are written as ordinary Markdown, `![alt](./_assets/pic.png)`. Astro resolves and optimises them; no `import` needed, so notes stay plain `.md`. Anything starting with `_` is ignored by the content collection.

## Where things are

```text
src/
├── consts.ts            site title, nav, links, status wording
├── content/blog/        the notes (and the Obsidian vault); one folder per series
│   ├── _templates/      note template, not published
│   └── <series>/_assets/  that series' images
├── lib/ink/             the painting
│   ├── glsl.ts          the shader: ink, bands, panels, the void
│   ├── painting.ts      seed → character (direction, shear, how much is machine)
│   ├── field.ts         the live painting behind the home page
│   ├── scenes.ts        what that painting does at each part of the page
│   └── covers.ts        the still paintings for notes and series
├── lib/markdown/        callouts and code-block titles
├── scripts/app.ts       everything that moves
├── styles/global.css    tokens, type, nav, rows, transitions
├── styles/prose.css     reading: Chinese + English + code
└── pages/, layouts/, components/
```

Colours are three values and a seal, all in `:root` at the top of `global.css`. The paintings read them from there, so changing `--paper`, `--ink` or `--mid` repaints everything.

Every painting is deterministic from its seed: a note's comes from its path, a series' from its folder name, the home page's from `Math.random()` on each visit (press `R` to paint again).

## Commands

| Command           | Action                                  |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Local server at `localhost:4321`        |
| `npm run build`   | Build to `./dist/`                      |
| `npm run preview` | Serve the build locally                 |
| `npm run new`     | Start a note                            |
