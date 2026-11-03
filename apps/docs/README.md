# mintsy docs

All mintsy documentation, built with [VitePress](https://vitepress.dev). This site runs locally only: there's no deploy and no Vercel project.

## Run

From the repo root, after `pnpm install`:

```sh
pnpm dev:docs                        # http://127.0.0.1:3002
pnpm --filter mintsy-docs build      # fails on dead links
pnpm --filter mintsy-docs preview    # serves the build on the same port
```

## Add or move a page

- Pages are the Markdown files in this folder. A folder's landing page is `index.md`.
- `SUMMARY.md` and `backend/SUMMARY.md` are the table of contents. `.vitepress/config.ts` builds the sidebar from them when it loads, and they aren't pages themselves. Add a new page to one of them or it won't be in the sidebar.
- Callouts use containers: `::: info`, `::: tip`, `::: warning`, `::: danger`, closed with `:::`.
- Diagrams use `mermaid` code blocks.
- Colors, fonts and the logo come from `@mintsy/brand`.

## Docs rules

- Each fact has one home. Link to it rather than repeating it.
- Update the docs in the same piece of work as the code change.
- Never put secrets in the docs: name the variable and where it's set, not its value.
