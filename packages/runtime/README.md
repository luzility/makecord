# @makecord/runtime

Runs [Makecord](https://makecord.luzili.tech) bots. It's the same engine the Makecord IDE uses, so a bot behaves the same on your computer and on a server.

```bash
npm install @makecord/runtime
DISCORD_TOKEN=... npx makecord start .
```

`makecord start <dir>` loads `makecord.json`, the flows in `commands/` and `events/`, and the message designs in `messages/`, then logs in to Discord. Add `--watch` to reload flows when their files change. The token can also come from a `.env` file in the project folder.

Projects created by the IDE already depend on this package and have `npm start` set up. See [Running a bot on a server](https://makecord.luzili.tech/docs/self-hosting/).

Apache-2.0
