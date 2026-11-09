# Makecord

Discord botları için açık kaynak bir IDE. Botlar görsel akışlarla kurulur, IDE içinde canlı test edilir ve aynı motorla kendi bilgisayarında veya sunucunda çalıştırılır. Arayüz İngilizce ve Türkçe.

## Repo

| Paket                 | Ne yapar                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| `apps/desktop`        | Electron IDE (React, dockview, React Flow)                                      |
| `apps/web`            | Tanıtım sitesi (Astro)                                                          |
| `packages/spec`       | `makecord.json` ve `*.flow.json` için Zod şemaları. Tek doğruluk kaynağı        |
| `packages/runtime`    | Headless motor + `makecord` CLI. Electron'a bağımlı değil, VPS'te de bu çalışır |
| `packages/plugin-sdk` | `definePlugin`, `defineNode`, `defineNodeMeta`                                  |
| `packages/templates`  | "Yeni Proje" şablonları                                                         |
| `packages/config`     | Ortak tsconfig'ler                                                              |
| `plugins/core`        | Yerleşik bloklar (Yanıt Ver, Mesaj Gönder, Koşul, Değişken, Rol Ver, Log)       |

## Geliştirme

Gereksinimler: Node ≥ 22.12, pnpm 12.

```bash
pnpm install
pnpm dev:desktop     # IDE (paketleri derler, electron-vite dev başlatır)
pnpm dev:web         # site, http://localhost:4321
pnpm build           # her şey
pnpm typecheck
pnpm test
pnpm lint            # biome
```

Runtime'ı IDE olmadan çalıştırmak için:

```bash
pnpm --filter @makecord/runtime build
DISCORD_TOKEN=... node packages/runtime/dist/cli.js start ./bot-klasoru --watch
```

Tasarım kararları ve gerekçeleri: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
