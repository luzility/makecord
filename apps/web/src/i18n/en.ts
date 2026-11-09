export const en = {
  meta: {
    title: "Makecord: an IDE for Discord bots",
    description:
      "Build Discord bots as visual flows, watch them run live while you save, and ship the same folder to your own server. Free and open source.",
  },
  nav: {
    docs: "Docs",
    docsHref: "/docs/",
    features: "Features",
    selfHost: "Self-hosting",
    plugins: "Plugins",
    download: "Download",
    switchTo: "Türkçe",
    switchHref: "/tr/",
  },
  hero: {
    title: "Build Discord bots in a real IDE",
    body: "Wire commands together as visual flows, watch each block light up as your bot runs it, and ship the same folder to your own server. Free and open source.",
    primary: "Download",
    secondary: "View source",
  },
  preview: {
    label: "Makecord editing the /greet command while the bot runs",
    running: "Running",
    start: "Start",
    condition: "Condition",
    reply: "Reply",
    replyOther: ["<@user> says hi"],
    replySelf: ["Hey {{user.displayName}},", "welcome to the server"],
    yes: "true",
    no: "false",
    used: "used",
    message: "Hey Mira, welcome to the server",
    today: "Today at 19:42",
    online: "Bramble#4821 is online in 3 servers",
    done: "done in 84 ms",
  },
  features: {
    title: "From the first command to a bot on your server",
    body: "Makecord handles the parts of bot making that aren't the fun part, so you can spend your time on what the bot actually does.",
    items: [
      {
        title: "Flows are files",
        body: "Every command and event is a readable JSON file in your project. Version it with git, review it, share it.",
      },
      {
        title: "Live while you save",
        body: "Change a flow while the bot runs and it takes effect on save. The block that just ran lights up in the editor.",
      },
      {
        title: "Your token stays out of the project",
        body: "Secrets are encrypted with your system keychain and only handed to the bot as environment variables while it runs.",
      },
      {
        title: "Problems before you run",
        body: "A missing intent, a block that never runs, an action used in the wrong place. The Problems panel catches it and fixes most with one click.",
      },
    ],
  },
  selfHost: {
    title: "Runs on your machine, then on your server",
    body: "The engine is a standalone npm package. Copy the project to a VPS, put your token in .env and start it. With Docker it's one line.",
    body2:
      "No accounts, no hosted service. When Discord's API changes, updating the engine is an npm update.",
    comment1: "# on your server",
    comment2: "# fill in DISCORD_TOKEN",
    comment3: "# or",
    online: "Bramble#4821 is online in 3 servers",
    registered: "Registered 3 commands: /ping /greet /rank",
  },
  plugins: {
    title: "Missing a block? Write it",
    body: "A plugin is a few block definitions and the functions that run them. Fields are Zod schemas, and the IDE builds the settings form from them.",
    body2:
      "Plugins only see the secrets you allow, never the bot token. A marketplace inside the IDE is on the way, so adding a database or an economy system will be one click.",
  },
  footer: {
    docs: "Documentation",
    openSource: "Free and open source",
    trademark: "Discord is a trademark of Discord Inc. Makecord is an independent project.",
  },
};
export type Dict = typeof en;
