# Mimari

## Ana fikir: proje = diskteki klasör

Bir Makecord projesi sıradan bir klasördür ve **olduğu gibi deploy edilebilir**:

```
my-bot/
├── makecord.json           # ad, intent'ler, plugin'ler, secret adları, cache limitleri
├── commands/*.flow.json    # slash komutları (görsel akış)
├── events/*.flow.json      # gateway event'leri
├── messages/*.message.json # mesaj tasarımları (embed / Components V2)
├── data/store.json         # kalıcı anahtar/değer verisi (store blokları). gitignore'da
├── package.json            # "start": "makecord start ."  → @makecord/runtime
├── Dockerfile, docker-compose.yml, .env.example
└── .makecord/              # IDE durumu (açık sekmeler, layout). gitignore'da
```

VPS'e taşımak için: `cp .env.example .env && npm install && npm start` ya da `docker compose up -d`. Ayrı bir "export" adımı gerekmez. Git, diff ve code review doğrudan çalışır.

## Runtime (headless)

`@makecord/runtime`, IDE'de ve sunucuda **aynı** motordur. Bu yüzden IDE'de görülen davranış sunucuda da aynıdır.

- **Interpreter:** Akış JSON'u, `core.trigger` node'undan başlayarak edge'ler takip edilerek çalıştırılır. Her node bir çıkış portu döndürür (`next`, `true`/`false`, …). Sonsuz döngüye karşı 2000 adım sınırı vardır. `core.repeat` sayacını `vars` içinde node id'siyle tutar.
- **Şablonlar:** `{{user.displayName}}` gibi değerler node verisi doğrulanmadan önce çözülür.
- **Kalıcı veri:** `src/store.ts`, `data/store.json` dosyasını belleğe alır. Yazmalar 500 ms debounce ile geçici dosyaya yazılıp `rename` ile atomik olarak değiştirilir, bot dururken `flush()` edilir. Plugin'ler buna `ctx.store` (`get/set/delete/increment/keys`) üzerinden erişir. Değerler sadece string/number/boolean'dır.
- **Etkileşimler:** Buton, seçim menüsü ve modal gönderimleri `buttonClick` / `selectMenu` / `modalSubmit` event akışlarına `customId` ile yönlendirilir (`vote:*` önek eşleşmesi, boş = hepsi). Komutlar ve bu üç event "etkileşimli akış"tır (`isInteractionFlow`). `needsInteraction` işaretli bloklar (Reply, Defer Reply, Show Form) sadece bunlarda kullanılabilir. Inspection bunu `needs-interaction` olarak raporlar, palet de bu blokları gizler.
- **Zamanlama:** `schedule` akışları `everyMinutes` için `setInterval`, `dailyAt` için kendini yeniden kuran `setTimeout` ile çalışır. Bot kapalıyken kaçan çalışmalar telafi edilmez.
- **Komutlar:** Seçeneklerde en fazla 25 `choices`, komutta `permissions` (`defaultMemberPermissions` olarak gönderilir).
- **Mesaj tasarımları:** `messages/**/*.message.json` dosyaları (`spec/src/message.ts`), `classic` (metin + embed + satırlar) ya da `componentsV2` (container, section, gallery, separator, text, row; `IsComponentsV2` bayrağı) biçimindedir. `runtime/src/message.ts` tasarımı şablonları doldurarak ham Discord API JSON'una çevirir, boş kalan embed/blokları atar. Bloklar `ctx.message(ad)` ile kullanır. Tasarım seçen alanlar JSON şemasında `format: "makecord-message"` taşır (`MESSAGE_FIELD_FORMAT`), IDE bunu seçici olarak gösterir, inspection `missing-message` ve karşılıksız butonlar için `unhandled-component` üretir. IDE'de tasarımcı `editors/message/` altındadır: form + Discord benzeri önizleme (markdown `marked` değil, küçük bir Discord markdown çeviricisi + DOMPurify).
- **Bot yetkileri:** `NodeMeta.permissions` bir bloğun ihtiyaç duyduğu bot yetkilerini (`spec/src/permissions.ts` tablosundaki adlar) listeler. IDE davet diyaloğu bunları ve temel yetkileri işaretli getirir, link `client_id`'yi token'ın ilk parçasından üretir (token renderer'a hiç gitmez, ana süreç `project:botId` ile sadece ID'yi döner). Bot hazır olunca her sunucuda eksik yetkileri uyarı olarak yazar. Discord ayrıcalıklı intent'leri reddederse `disallowed-intents` koduyla hata döner.
- **Debugger:** `runtime/src/debugger.ts`. IDE breakpoint'leri `.makecord/breakpoints.json`'da tutar ve `runtime:debug` IPC'si ile bota `breakpoints` / `resume` host mesajları gönderir (ana süreç son breakpoint setini saklar ve bot fork edilir edilmez yollar). Executor her bloktan önce `beforeNode` kancasını çağırır; breakpoint ya da adım modundaysa `debug/paused` mesajı (değişkenlerin sınırlı bir anlık görüntüsüyle) gider ve çalıştırma `resume` gelene kadar bekler. Cevap vermesi gereken bir etkileşim duraklarsa önce `deferReply` yapılır. Debugger sadece `--watch` (IDE) modunda kurulur.
- **Gateway Events:** `runtime/src/gateway.ts` `raw` paketlerini dinler, presence/typing'i atlar, saniyede 40 ile sınırlar ve her olayın bir akış tarafından karşılanıp karşılanmadığını (`handled`) işaretler. Bu mesajlar Run log'una değil ayrı bir listeye (en fazla 1000) gider.
- **Komut kaydı:** `runtime/src/commands.ts`. Aynı ada sahip akışlar tek komutta birleşir: alt komut (`command.subcommand`) ve grup (`command.group`) akışları `Subcommand` / `SubcommandGroup` seçeneklerine dönüşür. `type: "user" | "message"` context menu komutlarıdır. Yönlendirme anahtarı `commandKey` (`config role add`, `user:Report`). `dms` komutun `contexts`'ine `BotDM` ekler. Autocomplete etkileşimleri `komut.seçenek` (alt komutta `komut.altkomut.seçenek`) anahtarıyla `autocomplete` event akışlarına gider; akış cevap vermezse boş liste döner.
- **Event'ler:** `runtime/src/scope.ts` içindeki `EVENT_SCOPES` tablosu her Discord event'inin akışa hangi değişkenleri verdiğini tanımlar ve bot bu tablodaki tüm gateway event'lerini dinler. Event'in ihtiyaç duyduğu intent'ler `inspect.ts` > `EVENT_INTENTS`'tedir (discord.js'siz, IDE de kullanır).
- **Blok grupları:** `NodeMeta.group` paletteki alt başlığı belirler (çekirdekte `interaction`, `messages`, `members`, `server`). `NodeMeta.events` bir bloğu belirli event'lerle sınırlar (ör. **Suggest Choices** sadece `autocomplete`), ihlal `wrong-event` olarak raporlanır.
- **Hata izolasyonu:** Bozuk bir flow dosyası botu düşürmez, problem olarak raporlanır.
- **Hot reload:** `--watch` ile `*.flow.json` değişince akışlar yeniden yüklenir. Komut seti değiştiyse slash komutları yeniden kaydedilir (imza karşılaştırılarak, gereksiz API çağrısı yapılmaz).
- **Transport:** Electron `utilityProcess` içinde `parentPort`, `fork` ile başlatılınca `process.send`, tek başına çalışırken okunabilir stdout kullanılır (`src/reporter.ts`). Mesaj tipleri `@makecord/runtime/protocol`'de tanımlıdır.
- **Bellek:** discord.js cache'leri `makecord.json > cache` ile varsayılan olarak sınırlıdır (mesaj 50, üye 200, presence 0). IDE botu `--max-old-space-size=512` ile başlatır.

Alt yollar: `@makecord/runtime/project` ve `@makecord/runtime/inspect` discord.js içe aktarmaz. IDE ana process'i bunları kullanır, discord.js'i belleğe yüklemez.

## Plugin'ler

Bir node iki parçadan oluşur:

- **`NodeMeta`:** tip, başlık, kategori, çıkış portları, Zod alan şeması. discord.js içermez, IDE renderer'ı import edebilir. Özellikler formu `z.toJSONSchema` ile bu şemadan üretilir.
- **`run(ctx, data)`:** Sadece runtime'da çalışır.

Kurallar:

- Node tipleri `<plugin>.<ad>` şeklinde namespace'lidir ve yayından sonra değişmez.
- Plugin `engines.makecord` ile uyumlu olduğu runtime aralığını bildirir.
- Secret'lara sadece `permissions: ["secrets:AD"]` ile erişilebilir. `DISCORD_TOKEN` plugin'lere asla verilmez.
- Plugin'ler projenin `node_modules`'undan yüklenir. Bu sayede deploy edilen proje de onları kurar.

### Plugin'lerin IDE'de yüklenmesi

- Plugin kodu IDE'nin ana process'inde veya renderer'ında hiç çalışmaz. Proje açılınca ayrı bir **dil servisi** başlar (`@makecord/runtime/language-service`, Electron `utilityProcess`). Bu servis plugin'leri yükler, blok tanımlarını JSON olarak verir (`describeNode`: alan şemaları `z.toJSONSchema` ile) ve inspection'ları çalıştırır.
- Renderer'ın paleti, Özellikler formu ve node'ları bu katalogdan beslenir. Servis henüz yanıt vermediyse yerleşik bloklar yerel olarak tanımlanır.
- Node ES modüllerini bellekten atamadığı için `makecord.json`'daki plugin listesi değişince servis yeniden başlatılır ve renderer'a `catalog:changed` gönderilir.
- Plugin'ler kendi zod kopyalarını getirebilir. Zod 4'ün meta kayıt defteri `globalThis` üzerinde tutulduğu için alan başlıkları korunur.
- Her plugin için bir durum tutulur: yüklendi mi, sürümü, `engines.makecord` uyumluluğu (`semver`). Yüklenemeyen veya uyumsuz plugin'ler Problems panelinde görünür (`plugin-failed`, `plugin-incompatible`).
- **Marketplace:** npm'in arama API'si üzerinden `keywords:makecord-plugin` etiketli paketler listelenir, Makecord'un ayrı bir sunucusu yoktur. Kurma ve kaldırma projede `npm install` / `npm uninstall` çalıştırır ve `makecord.json`'u günceller. Plugin yazarları için klasörden kurma da vardır.
- **Bellek:** Dil servisi yaklaşık 45–50 MB (PSS) tutar ve status bar'daki IDE toplamına dahildir.

## Ayarlar

`Ctrl+,` ile açılır. IDE ayarları (`userData/settings.json`, ana process'te doğrulanır) şunlardır: dil, ızgaraya hizalama, bot başlayınca Run panelini açma, bot bellek sınırı (`--max-old-space-size`, 128–4096 MB) ve kısayol listesi. Proje ayarları `makecord.json`'u düzenler: ad, test sunucusu ID'si, intent'ler (ayrıcalıklı olanlar işaretli) ve cache limitleri. Her değişiklik `ProjectConfig` ile doğrulanır, geçersiz değer diske yazılmaz. Plugin'ler de ayrı bir sayfadadır.

## Secret'lar

- Electron `safeStorage` (Linux'ta libsecret/KWallet, macOS'ta Keychain, Windows'ta DPAPI) ile şifrelenip `userData/secrets.json` içinde proje yolu başına saklanır.
- Renderer secret ayarlayabilir veya silebilir ama **hiçbir zaman geri okuyamaz**.
- Değerler sadece bot process'inin env'ine verilir. Bot process'i ana process'in env'ini miras almaz, yalnızca `PATH`, `HOME` gibi birkaç değişken izin listesindedir.
- Linux'ta keyring yoksa (`basic_text`) arayüz uyarı gösterir.

## IDE

- **Process modeli:** Ana process (dosya, secret, IPC), tek renderer ve bot (`utilityProcess`). Renderer sandbox'lı ve `contextIsolation` açık. Dosya erişimi proje kökü dışına çıkamaz (`projectPath`).
- **Pencere:** Toolbar aynı zamanda başlık çubuğu (`components/Titlebar.tsx`). Linux/Windows'ta `titleBarStyle: "hidden"` + `titleBarOverlay` kullanılır, pencere kontrollerini işletim sistemi grafit renklerle çizer. Sağdaki boşluk `env(titlebar-area-*)` ile hesaplanır. macOS'ta `hiddenInset` + trafik ışıkları. Boş alan pencereyi sürükler. Bir dialog açıkken `html[data-modal]` sürüklemeyi kapatır, çünkü sürükleme bölgeleri z-index'i dikkate almaz. Pencere başlığı açık projenin adını taşır. İkon: `resources/icon.png`, `assets/brand/logo.svg`'den üretilir.
- **Eylemler:** Her komut `lib/actions.ts`'te tek bir kayıtta tanımlıdır: etiket (i18n anahtarı), kısayol, ne zaman kullanılabilir olduğu ve ne yaptığı. ☰ ana menü (File/Edit/View/Run/Help), Search Everywhere ve klavye kısayolları bu listeyi okur. Kısayollar `Mod+Shift+N` biçiminde yazılır, `Mod` macOS'ta ⌘, diğer sistemlerde Ctrl'dir. Metin alanındayken alanın kendi kısayolları (örn. `Ctrl+Z`) önceliklidir, `global` işaretli eylemler hariç. Dialog veya menü açıkken kısayollar çalışmaz. Windows/Linux'ta Electron'un varsayılan menüsü kaldırılmıştır (`Ctrl+R` sayfayı yenileyip kaydedilmemiş durumu silebiliyordu).
- **Geri al:** Akış değişiklikleri dosya başına 100 adımlık bir geçmiş tutar (`updateFlow`). Aynı `mergeKey` ile 600ms içinde gelen değişiklikler, örneğin bir alana yazılan her karakter, tek adımda birleşir. Dosya IDE dışında değişirse o dosyanın geçmişi silinir.
- **Metin dosyaları:** Monaco (VS Code'un editörü) ile açılır: VS Code'un koyu tema sözdizimi renkleri IDE'nin grafit yüzeyleri üzerinde, minimap, sticky scroll, renkli parantez çiftleri, arama/değiştir ve kendi geri al geçmişi vardır. Worker'lar pakete dahildir, CDN kullanılmaz. `makecord.json` ve `*.flow.json` için `spec` paketindeki Zod şemalarından üretilen JSON şemaları kayıtlıdır, bu dosyalarda otomatik tamamlama, hover açıklamaları ve hata işaretleri gelir. Markdown dosyalarında Kod / Bölünmüş / Önizleme görünümleri vardır. Önizleme `marked` ile üretilir, `DOMPurify` ile temizlenir ve linkler sistem tarayıcısında açılır. Okunamayan bir akış dosyası da bu editörde açılır. Monaco'nun kendi işlediği tuşlar (`Ctrl+K` akorları, `F1`) IDE eylemlerini tetiklemez (`defaultPrevented`).
- **Kaydetme:** Varsayılan olarak değişiklikler 300 ms sonra otomatik diske yazılır (Ayarlar > Flow editor > Otomatik kaydet). Kapalıyken sadece Ctrl+S (`file.save`, tüm kirli dosyalar), sekme kapatma ve çıkışta kaydedilir; çalışan bot yalnızca diske yazılanı görür. Editör sekmeleri (`editors/EditorTab.tsx`) kaydedilmemiş dosyada nokta, kaydedilemeyen (geçersiz) dosyada uyarı rengi nokta gösterir.
- **Yerleşim:** JetBrains tarzı sabit alanlar: sol (Proje), sağ (Özellikler) ve alt (Run, Debug, Problems, Gateway Events). Alanlar `components/ToolWindows.tsx`'teki kenar şeritlerinden veya Alt+1/2/4/5/6/7 ile açılıp gizlenir, tutamaklarla boyutlanır; durum store'daki `tools`'tadır (`lib/tools.ts`). dockview sadece ortadaki editör sekmeleri için kullanılır, bu yüzden son sekme kapanınca editör alanı çökmez, yerine boş durum gösterilir. Hepsi `.makecord/workspace.json`'a (`version: 2`, `tools` + `editors`) kaydedilir; eski biçim görülürse varsayılan yerleşim kullanılır.
- **Kaydetme:** JetBrains gibi otomatik (300 ms debounce). Proje kapanırken ve pencere kapanırken bekleyen kayıtlar ve layout önce yazılır (`flushAll`). Pencere kapanışında ana process `app:beforeClose` gönderir, renderer kaydedip `app:closeReady` ile yanıt verir. Yanıt 2 saniye içinde gelmezse pencere yine kapanır. Şemadan geçmeyen bir akış (örn. boş komut adı) ekranda kalır ama diske yazılmaz, böylece dosya bozulmaz. Kayıt hataları status bar'da gösterilir. Dosya izleyici dış değişiklikleri alır, ama kaydedilmemiş yerel değişiklik varsa diskteki sürüm onun üzerine yazılmaz. Okunamayan bir akış metin editöründe açılır. Silinmiş dosyanın sekmesi "dosya artık yok" der.
- **Bot süreci:** `runtime-host` başlatma aşamasını ayrı bir durum olarak tutar. İkinci bir Başlat yeni bot açmaz, başlarken gelen Durdur botun hiç başlamamasını sağlar. Runtime hata koduyla kapanırsa (`missing-token`, `login-failed`) bu kod "Durduruldu" ile ezilmez, IDE kodu kullanıcının dilinde gösterir. Çalıştır/Durdur butonları ortak bir meşgul durumu paylaşır.
- **Canlı izleme:** Runtime `flow/node` olayları yayınlar, editör çalışan node'u yeşil vurgular. Run panelindeki kaynak linkleri ilgili dosyayı açıp node'u seçer.
- **Inspection'lar:** `inspectProject` bilinmeyen node, yanlış bağlam, geçersiz alan, kopuk bağlantı, ulaşılamayan node ve eksik intent kontrollerini yapar. Eksik intent için quick-fix vardır.

### Görsel dil

- **Yüzeyler:** IDE'de grafit, sitede mürekkep (gece) rampası. Üç metin rolü var (`fg`, `muted`, `faint`) ve kenarlıklar %8–9 opaklıkta hairline.
- **Accent: sinyal amberi (`#f5a524`)**, yalnızca "canlı" anlamında kullanılır: çalışan bot, o anda çalıştırılan blok, sinyalin geçtiği kablo. Buton, sekme ya da seçim rengi değildir. Birincil buton kırık beyazdır, seçim nötr bir yüzey adımıdır.
- **İmza:** `Led` bileşeni (`components/Logo.tsx`). Çalışan node'da, status bar'da, Run panelinde ve sitedeki önizlemede aynı nokta kullanılır.
- **Arayüz fontu:** Ayarlar → Görünüm'den seçilir, varsayılan Beacon. Seçenekler: Geist ve [fontzz](https://github.com/Luffixos/fontzz)'den gelen 8 font: Rondel, Beacon, Cove, Aurelia, Halden, Alder, Tessera, Mallow (değişken `woff2`, her biri ~25–34 KB, OFL 1.1, Türkçe karakter kapsamı doğrulandı). Seçim `--font-sans` değişkenini değiştirir. Lisans metinleri `apps/desktop/src/renderer/src/assets/fonts/<Font>/OFL.txt` dosyalarındadır ve paketleme sırasında uygulamayla birlikte dağıtılmalıdır. fontzz'in mono fontları alınmadı, çünkü 0/O ve l/I'yı yeterince ayırt etmiyorlar.
- **Tip:** Beacon (arayüz, IDE'de varsayılan, tanıtım sitesinde ve dokümanlarda da kullanılır) ve JetBrains Mono (kod, log, meta, keycap). Beacon `woff2` dosyası lisansıyla birlikte paketlenir, JetBrains Mono `@fontsource-variable` paketinden gelir, CDN kullanılmaz. IDE ölçeği `text-meta/label/body/title/heading`: 11/12/13/14/18.
- **Kategori renkleri** (yeşil, mavi, lila, turkuaz) sadece blok tiplerini ayırt eden küçük noktalardır.

## Çoklu dil (i18n)

- Kaynak dil **İngilizce**. Runtime log'ları ve hata mesajları da İngilizcedir.
- **Desktop:** `src/renderer/src/i18n/en.ts` sözlüğün şeklini belirler, `tr.ts` aynı şekle uymak zorundadır (TypeScript zorlar). `useT()` `t(key, vars)` ve çoğul için `tn(key, count)` döndürür. Değişkenler `%{ad}` sözdizimiyle yazılır, çünkü `{{…}}` bot şablon sözdizimidir. Dil seçimi `localStorage`'da tutulur. Karşılama ekranından veya Search Everywhere'dan değiştirilebilir.
- **Plugin'ler** kendi çevirilerini `NodeMeta.locales` ile getirir (başlık, açıklama, alanlar, port etiketleri). Marketplace plugin'leri de aynı yolu kullanır.
- **Problems:** Runtime `code` ve `params` döndürür, IDE bunları `lib/problems.ts` ile kullanıcının diline çevirir. Bilinmeyen kodlar İngilizce `message` ile gösterilir.
- **Site:** Astro i18n routing kullanılır: `/` İngilizce, `/tr/` Türkçe. Metinler `apps/web/src/i18n/*.ts` içindedir.
- Yeni dil eklemek için: desktop'ta `i18n/<dil>.ts` ve `messages`'a kayıt, sitede `astro.config.mjs > locales` ve `pages/<dil>/index.astro`.

### RAM bütçesi

Hedef: Proje açıkken IDE ~250–400 MB (PSS), bot ek olarak ~60–150 MB.

- Status bar'daki ölçüm Linux'ta **PSS**, Windows'ta `privateBytes` kullanır. RSS paylaşılan kütüphaneleri her process için tekrar saydığı için toplamı yaklaşık iki katına çıkarır.
- Run paneli 5.000 satırlık ring buffer tutar ve son 1.000 satırı render eder.
- React Flow `onlyRenderVisibleElements` ile çalışır.
- Monaco ve Markdown önizlemesi ayrı parçalar halinde ilk metin dosyası açılınca yüklenir. Sadece görsel akışla çalışan bir kullanıcı bu maliyeti hiç ödemez. Monaco açıkken IDE yaklaşık 120–130 MB daha fazla kullanır (ölçüm: iki metin sekmesiyle ~570 MB PSS). TypeScript worker'ı yalnızca bir `.js`/`.ts` dosyası açılınca başlar.

İlk ölçüm (Linux, Wayland, örnek proje açık, akış editörü açık): IDE ≈ 280–360 MB PSS. Fontlar ve i18n eklendikten sonra da ≈ 340–400 MB. MiniMap varsayılan olarak kapalıdır.

## Dokümantasyon

`apps/web` içinde Starlight + MDX ile, `/docs/` (İngilizce) ve `/tr/docs/` (Türkçe) altında yer alır. İçerik dosyaları `apps/web/src/content/docs/` altındadır. Arama Pagefind ile build sırasında üretilir.

Referans sayfaları koddan üretilir, böylece kodla dokümantasyon birbirinden ayrışmaz:

- **Bloklar:** `BlockReference.astro`, `@makecord/plugin-core/meta`'yı okur. Alan şemaları ve plugin çevirileri (`locales`) oradan gelir.
- **Proje ayarları:** `ProjectConfigReference.astro`, `@makecord/spec`'teki `ProjectConfig` şemasını okur. Açıklamalar şemadaki `.meta({ description })` alanlarından gelir.

Yeni bir blok veya `makecord.json` alanı eklendiğinde ilgili referans sayfası kendiliğinden güncellenir. Çevrilmemiş sayfalarda Starlight İngilizce içeriği bir notla gösterir.

## Yol haritası

1. ~~MVP: proje, akış editörü, Run/Problems, secret'lar, headless runtime~~
2. `.ts` komutları (runtime esbuild ile derler), "Koda dönüştür". Monaco'nun TypeScript servisine runtime ve plugin-sdk tipleri verilerek otomatik tamamlama sağlanacak
3. Debugger (breakpoint, adım adım, değişken inceleme), Gateway Events paneli, Commands Sync diff'i
4. Embed/Component tasarımcısı, Git paneli, terminal (xterm.js + node-pty)
5. Run configuration'lar: SSH ile VPS'e deploy, Docker
6. Plugin marketplace: IDE içinden plugin arama ve kurma (npm paketlerine çözümlenen bir index, örn. veritabanı ve ekonomi plugin'leri)
7. Paketleme (electron-builder) ve otomatik güncelleme (electron-updater). Font lisansları (`assets/fonts/*/OFL.txt`) `extraResources` ile pakete eklenmeli
