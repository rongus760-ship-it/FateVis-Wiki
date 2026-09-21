import { defineConfig, type DefaultTheme } from 'vitepress'

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

// The reference chapters exist in English only; the Russian sidebar links to them and says so.
const ref = (l: 'en' | 'ru', text: string, path: string) =>
  l === 'ru' ? { text: `${text} · EN`, link: `/en/${path}` } : { text, link: `/en/${path}` }

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
        ref(l, 'Bridge: window.fvui', 'fv-ui/bridge'),
        ref(l, 'Topics and actions', 'fv-ui/topics-actions'),
        ref(l, 'Capabilities', 'fv-ui/capabilities'),
        ref(l, 'JS SDK', 'fv-ui/sdk'),
      ],
    },
    {
      text: ru ? 'Паки' : 'Packs',
      items: [
        ref(l, 'Pack format', 'fv-ui/packs'),
        ref(l, 'Servo support matrix', 'fv-ui/servo'),
        ref(l, 'Dev workflow', 'fv-ui/dev-workflow'),
        ref(l, 'Distribution', 'fv-ui/distribution'),
        ref(l, 'Troubleshooting', 'fv-ui/troubleshooting'),
      ],
    },
    {
      text: ru ? 'Для Java и серверов' : 'Java and servers',
      items: [
        ref(l, 'Addon mods: FvUiApi', 'fv-ui/addons-java'),
        ref(l, 'Servers: fvui:data', 'fv-ui/server'),
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
        ref(l, 'Title, skins, flow and mirror', 'fv-menu/surfaces'),
        ref(l, 'Loading page', 'fv-menu/loading'),
        ref(l, 'Server cards', 'fv-menu/server-cards'),
      ],
    },
    {
      text: ru ? 'Редактор' : 'Editor',
      items: [
        ref(l, 'Layout document', 'fv-menu/layout-document'),
        ref(l, 'Layout editor', 'fv-menu/editor'),
        ref(l, 'Code panel', 'fv-menu/code-editor'),
        ref(l, 'Editor plugins', 'fv-menu/editor-plugins'),
      ],
    },
    {
      text: 'FancyMenu',
      items: [ref(l, 'Coming from FancyMenu', 'fv-menu/fancymenu-map')],
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
        ref(l, 'The HUD surface', 'fv-hud/hud-surface'),
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

export default defineConfig({
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
