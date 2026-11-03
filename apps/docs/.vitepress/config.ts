import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type DefaultTheme } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const require = createRequire(import.meta.url)
const docsRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

type SidebarItem = DefaultTheme.SidebarItem

/** Reads a GitBook-style SUMMARY.md into sidebar sections, one per `## heading`. */
function sidebarFromSummary(dir: string): SidebarItem[] {
  const base = dir ? `/${dir}/` : '/'
  const file = join(docsRoot, dir, 'SUMMARY.md')
  const sections: SidebarItem[] = [{ items: [] }]
  const stack: { indent: number; item: SidebarItem }[] = []

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      sections.push({ text: heading[1], items: [] })
      stack.length = 0
      continue
    }

    const entry = line.match(/^(\s*)[*-]\s+\[(.+)\]\((.+)\)\s*$/)
    if (!entry) continue
    const [, indent, text, target] = entry
    if (!existsSync(join(docsRoot, dir, target))) {
      throw new Error(`${file} links to a page that doesn't exist: ${target}`)
    }

    const link = base + target.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    const item: SidebarItem = { text, link }
    while (stack.length && stack[stack.length - 1].indent >= indent.length) stack.pop()
    const parent = stack.at(-1)?.item
    if (parent) parent.collapsed = true
    ;((parent ?? sections.at(-1)!).items ??= []).push(item)
    stack.push({ indent: indent.length, item })
  }

  return sections.filter((section) => section.items?.length)
}

function brandDataUri(path: string, type: string) {
  const file = require.resolve(`@mintsy/brand/assets/${path}`)
  return `data:${type};base64,${readFileSync(file).toString('base64')}`
}

/** VitePress variables for one brand mode. `html` beats the default theme's `:root`. */
function themeVars(c: Record<string, string>) {
  return `
    --vp-c-brand-1: ${c.brand};
    --vp-c-brand-2: color-mix(in srgb, ${c.brand} 85%, ${c.foreground});
    --vp-c-brand-3: ${c.brand};
    --vp-c-brand-soft: color-mix(in srgb, ${c.brand} 14%, transparent);
    --vp-button-brand-text: ${c.brandForeground};
    --vp-button-brand-hover-text: ${c.brandForeground};
    --vp-button-brand-active-text: ${c.brandForeground};
    --vp-c-bg: ${c.background};
    --vp-c-bg-alt: ${c.card};
    --vp-c-bg-elv: ${c.popover};
    --vp-c-bg-soft: ${c.secondary};
    --vp-c-text-1: ${c.foreground};
    --vp-c-text-2: ${c.mutedForeground};
    --vp-c-divider: ${c.border};`
}

const { themes, defaultTheme } = require('@mintsy/brand/tokens.json')
const { light, dark } = themes[defaultTheme]

export default withMermaid(
  defineConfig({
    title: 'mintsy docs',
    description: 'How the mintsy services work and fit together.',
    cleanUrls: true,
    // README.md is about running this app; SUMMARY.md files only feed the sidebar.
    srcExclude: ['README.md', '**/SUMMARY.md'],
    head: [
      ['link', { rel: 'icon', href: brandDataUri('icons/ink-coral/favicon.png', 'image/png') }],
      ['style', {}, `html:root {${themeVars(light)}\n}\nhtml.dark {${themeVars(dark)}\n}`],
    ],
    vite: {
      // pnpm doesn't hoist mermaid's CommonJS dependencies (dayjs, cytoscape), so the plugin's own
      // optimizeDeps entries can't resolve them and `vitepress dev` renders a blank page without this.
      optimizeDeps: { include: ['mermaid'] },
    },
    themeConfig: {
      siteTitle: 'docs',
      logo: {
        light: brandDataUri('logo/wordmark-ink-coral-on-light.svg', 'image/svg+xml'),
        dark: brandDataUri('logo/wordmark-ink-coral-on-dark.svg', 'image/svg+xml'),
        alt: 'mintsy',
      },
      nav: [
        { text: 'Overview', link: '/overview' },
        { text: 'Contracts', link: '/contracts' },
        { text: 'Backend', link: '/backend/', activeMatch: '^/backend/' },
      ],
      sidebar: {
        '/backend/': sidebarFromSummary('backend'),
        '/': sidebarFromSummary(''),
      },
      search: { provider: 'local' },
    },
  }),
)
