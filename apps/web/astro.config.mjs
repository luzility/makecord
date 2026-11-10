import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://makecord.luzili.tech",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "tr"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    starlight({
      title: "Makecord Docs",
      description: "How to build, run and host Discord bots with Makecord.",
      logo: { src: "./src/assets/logo.svg", alt: "Makecord" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/luzility/makecord" }],
      customCss: ["./src/styles/docs.css"],
      editLink: { baseUrl: "https://github.com/luzility/makecord/edit/main/apps/web/" },
      lastUpdated: false,
      expressiveCode: {
        themes: ["github-dark-default", "github-light-default"],
        styleOverrides: {
          borderRadius: "12px",
          borderColor: "var(--sl-color-hairline)",
          codeFontFamily: "var(--sl-font-mono)",
          uiFontFamily: "var(--sl-font)",
          frames: { shadowColor: "transparent" },
        },
      },
      sidebar: [
        {
          label: "Start here",
          translations: { tr: "Başlarken" },
          items: [{ slug: "docs" }, { slug: "docs/installation" }, { slug: "docs/first-bot" }],
        },
        {
          label: "Concepts",
          translations: { tr: "Kavramlar" },
          items: [
            { slug: "docs/projects" },
            { slug: "docs/flows" },
            { slug: "docs/functions" },
            { slug: "docs/variables" },
            { slug: "docs/messages" },
            { slug: "docs/debugging" },
            { slug: "docs/secrets" },
          ],
        },
        {
          label: "Guides",
          translations: { tr: "Rehberler" },
          items: [
            { slug: "docs/ai" },
            { slug: "docs/self-hosting" },
            { slug: "docs/writing-plugins" },
          ],
        },
        {
          label: "Reference",
          translations: { tr: "Referans" },
          items: [
            { slug: "docs/blocks" },
            { slug: "docs/project-config" },
            { slug: "docs/problems" },
            { slug: "docs/cli" },
          ],
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
