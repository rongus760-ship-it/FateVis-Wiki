import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type DefaultTheme } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// GitHub Pages serves a project site from /<repo>/. The workflow passes DOCS_BASE for whatever
// the repository is called; a user site (<name>.github.io) or a custom domain wants '/'.
const base = process.env.DOCS_BASE ?? '/'
// "owner/repo", set by GitHub Actions. Drives the "Edit this page" link.
const repo = process.env.GITHUB_REPOSITORY ?? ''
const owner = 'https://github.com/rongus760-ship-it'

function nav(l: 'en' | 'ru'): DefaultTheme.NavItem[] {
  const ru = l === 'ru'
  return [
    { text: ru ? 'Введение' : 'Guide', link: `/${l}/guide/what-is-fatevis`, activeMatch: `/${l}/guide/` },
    { text: 'FV-UI', link: `/${l}/fv-ui/`, activeMatch: `/${l}/fv-ui/` },
    { text: 'FV-Menu', link: `/${l}/fv-menu/`, activeMatch: `/${l}/fv-menu/` },
    { text: 'FV-Hud', link: `/${l}/fv-hud/`, activeMatch: `/${l}/fv-hud/` },
  ]
}

const guide = (l: 'en' | 'ru'): DefaultTheme.SidebarItem[] => {
  const ru = l === 'ru'
  return [
    {
      text: ru ? 'Введение' : 'Guide',
      items: [
        { text: ru ? 'Что такое FateVis' : 'What is FateVis', link: `/${l}/guide/what-is-fatevis` },
        { text: ru ? 'Установка' : 'Install', link: `/${l}/guide/install` },
        { text: ru ? 'Статус и история версий' : 'Status and changelog', link: `/${l}/guide/status` },
      ],
    },
    {
      text: ru ? 'Моды' : 'Mods',
      items: [
        { text: 'FV-UI', link: `/${l}/fv-ui/` },
        { text: 'FV-Menu', link: `/${l}/fv-menu/` },
        { text: 'FV-Hud', link: `/${l}/fv-hud/` },
      ],
    },
  ]
}

// A reference chapter is linked in Russian as soon as docs/ru has it. Until then the Russian
// sidebar points at the English page and says so. `ru` is the Russian title for that case.
const hasRu = (path: string) => existsSync(fileURLToPath(new URL(`../ru/${path}.md`, import.meta.url)))
const ref = (l: 'en' | 'ru', text: string, path: string, ru?: string) => {
  if (l === 'en') return { text, link: `/en/${path}` }
  return hasRu(path) ? { text: ru ?? text, link: `/ru/${path}` } : { text: `${text} · EN`, link: `/en/${path}` }
}

const fvui = (l: 'en' | 'ru'): DefaultTheme.SidebarItem[] => {
  const ru = l === 'ru'
  return [
    {
      text: 'FV-UI',
      items: [
        { text: ru ? 'Обзор' : 'Overview', link: `/${l}/fv-ui/` },
        { text: ru ? 'Быстрый старт' : 'Quick start', link: `/${l}/fv-ui/quick-start` },
      ],
    },
    {
      text: ru ? 'Страница и игра' : 'Page and game',
      items: [
        ref(l, 'Bridge: window.fvui', 'fv-ui/bridge', 'Мост: window.fvui'),
        ref(l, 'Topics and actions', 'fv-ui/topics-actions', 'Темы и действия'),
        ref(l, 'Capabilities', 'fv-ui/capabilities', 'Права'),
        ref(l, 'JS SDK', 'fv-ui/sdk', 'JS SDK'),
      ],
    },
    {
      text: ru ? 'Паки' : 'Packs',
      items: [
        ref(l, 'Pack format', 'fv-ui/packs', 'Формат пака'),
        ref(l, 'Servo support matrix', 'fv-ui/servo', 'Матрица поддержки Servo'),
        ref(l, 'Dev workflow', 'fv-ui/dev-workflow', 'Цикл разработки'),
        ref(l, 'Distribution', 'fv-ui/distribution', 'Распространение'),
        ref(l, 'Troubleshooting', 'fv-ui/troubleshooting', 'Решение проблем'),
      ],
    },
    {
      text: ru ? 'Для Java и серверов' : 'Java and servers',
      items: [
        ref(l, 'Addon mods: FvUiApi', 'fv-ui/addons-java', 'Моды-аддоны: FvUiApi'),
        ref(l, 'Servers: fvui:data', 'fv-ui/server', 'Серверы: fvui:data'),
      ],
    },
  ]
}

const fvmenu = (l: 'en' | 'ru'): DefaultTheme.SidebarItem[] => {
  const ru = l === 'ru'
  return [
    { text: 'FV-Menu', items: [{ text: ru ? 'Обзор' : 'Overview', link: `/${l}/fv-menu/` }] },
    {
      text: ru ? 'Экраны' : 'Surfaces',
      items: [
        ref(l, 'Title, skins, flow and mirror', 'fv-menu/surfaces', 'Титул, скины, flow и mirror'),
        ref(l, 'Loading page', 'fv-menu/loading', 'Страница загрузки'),
        ref(l, 'Server cards', 'fv-menu/server-cards', 'Карточки серверов'),
      ],
    },
    {
      text: ru ? 'Редактор' : 'Editor',
      items: [
        ref(l, 'Layout document', 'fv-menu/layout-document', 'Документ раскладки'),
        ref(l, 'Layout editor', 'fv-menu/editor', 'Редактор раскладки'),
        ref(l, 'Code panel', 'fv-menu/code-editor', 'Панель кода'),
        ref(l, 'Editor plugins', 'fv-menu/editor-plugins', 'Плагины редактора'),
      ],
    },
    {
      text: 'FancyMenu',
      items: [ref(l, 'Coming from FancyMenu', 'fv-menu/fancymenu-map', 'Если вы с FancyMenu')],
    },
  ]
}

const fvhud = (l: 'en' | 'ru'): DefaultTheme.SidebarItem[] => {
  const ru = l === 'ru'
  return [
    {
      text: 'FV-Hud',
      items: [
        { text: ru ? 'Обзор' : 'Overview', link: `/${l}/fv-hud/` },
        ref(l, 'The HUD surface', 'fv-hud/hud-surface', 'Экран HUD'),
      ],
    },
  ]
}

const sidebar = (l: 'en' | 'ru'): DefaultTheme.Sidebar => ({
  [`/${l}/guide/`]: guide(l),
  [`/${l}/fv-ui/`]: fvui(l),
  [`/${l}/fv-menu/`]: fvmenu(l),
  [`/${l}/fv-hud/`]: fvhud(l),
})

const editLink = repo
  ? { pattern: `https://github.com/${repo}/edit/main/docs/:path` }
  : undefined

export default withMermaid({
  base,
  title: 'FateVis',
  description: 'Web UI for Minecraft: FV-UI, FV-Menu and FV-Hud',
  appearance: 'force-dark',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    ['meta', { name: 'theme-color', content: '#1a1b26' }],
  ],

  locales: {
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: nav('en'),
        sidebar: sidebar('en'),
        editLink: editLink && { ...editLink, text: 'Edit this page on GitHub' },
        footer: {
          message: 'Released under the MIT License. Not an official Minecraft product.',
          copyright: 'Copyright © 2026 Fate',
        },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      link: '/ru/',
      description: 'Веб-интерфейсы для Minecraft: FV-UI, FV-Menu и FV-Hud',
      themeConfig: {
        nav: nav('ru'),
        sidebar: sidebar('ru'),
        editLink: editLink && { ...editLink, text: 'Править эту страницу на GitHub' },
        outline: { label: 'На этой странице', level: [2, 3] },
        docFooter: { prev: 'Назад', next: 'Дальше' },
        lastUpdated: { text: 'Обновлено' },
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        langMenuLabel: 'Язык',
        footer: {
          message: 'Лицензия MIT. Не является официальным продуктом Minecraft.',
          copyright: '© 2026 Fate',
        },
      },
    },
  },

  // Diagrams are ```mermaid fences. Colours follow theme/custom.css.
  mermaid: {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: '#1a1b26',
      fontFamily: "'0xProto', 'JetBrains Mono', ui-monospace, monospace",
      fontSize: '14px',
      primaryColor: '#1f2335',
      primaryTextColor: '#d5daf5',
      primaryBorderColor: '#bb9af7',
      secondaryColor: '#11224a',
      secondaryTextColor: '#9dc0ff',
      secondaryBorderColor: '#3f6fe0',
      tertiaryColor: '#16161e',
      tertiaryTextColor: '#a9b1d6',
      tertiaryBorderColor: '#3a3d55',
      lineColor: '#7fa2dd',
      textColor: '#d5daf5',
      mainBkg: '#1f2335',
      nodeBorder: '#bb9af7',
      clusterBkg: 'rgba(17, 34, 74, 0.35)',
      clusterBorder: '#3a3d55',
      edgeLabelBackground: '#1a1b26',
      actorBkg: '#11224a',
      actorBorder: '#3f6fe0',
      actorTextColor: '#9dc0ff',
      actorLineColor: '#3a3d55',
      signalColor: '#7fa2dd',
      signalTextColor: '#d5daf5',
      labelBoxBkgColor: '#11224a',
      labelBoxBorderColor: '#3f6fe0',
      labelTextColor: '#9dc0ff',
      noteBkgColor: '#2a2440',
      noteBorderColor: '#bb9af7',
      noteTextColor: '#d5daf5',
      activationBkgColor: '#3b3164',
      transitionColor: '#7fa2dd',
      stateLabelColor: '#d5daf5',
      altBackground: '#16161e',
    },
    flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
    sequence: { mirrorActors: false, messageAlign: 'left' },
  },

  themeConfig: {
    logo: '/logo.svg',
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: owner }],
    search: {
      provider: 'local',
      options: {
        locales: {
          ru: {
            translations: {
              button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
              modal: {
                noResultsText: 'Ничего не найдено',
                resetButtonTitle: 'Сбросить',
                footer: { selectText: 'выбрать', navigateText: 'перейти', closeText: 'закрыть' },
              },
            },
          },
        },
      },
    },
  },
})
