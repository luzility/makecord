import type { Dict } from "./en";

export const tr: Dict = {
  meta: {
    title: "Makecord · Discord botları için IDE",
    description:
      "Discord botlarını görsel akışlarla kur, kaydettiğin anda canlı izle ve aynı klasörü kendi sunucuna taşı. Ücretsiz ve açık kaynak.",
  },
  nav: {
    docs: "Dokümanlar",
    docsHref: "/tr/docs/",
    features: "Özellikler",
    selfHost: "Sunucuda çalıştır",
    plugins: "Plugin'ler",
    download: "İndir",
    switchTo: "English",
    switchHref: "/",
  },
  hero: {
    title: "Discord botlarını gerçek bir IDE'de kur",
    body: "Komutları görsel akışlarla birbirine bağla, botun çalıştırdığı her bloğun yandığını gör ve aynı klasörü kendi sunucuna taşı. Ücretsiz ve açık kaynak.",
    primary: "İndir",
    secondary: "Kaynak koda bak",
  },
  preview: {
    label: "Bot çalışırken /greet komutunu düzenleyen Makecord",
    running: "Çalışıyor",
    start: "Başlangıç",
    condition: "Koşul",
    reply: "Yanıt Ver",
    replyOther: ["<@user> selam söylüyor"],
    replySelf: ["Selam {{user.displayName}},", "sunucuya hoş geldin"],
    yes: "doğru",
    no: "yanlış",
    used: "kullandı",
    message: "Selam Mira, sunucuya hoş geldin",
    today: "Bugün 19:42",
    online: "Bramble#4821 çevrimiçi · 3 sunucu",
    done: "bitti · 84 ms",
  },
  features: {
    title: "İlk komuttan sunucundaki bota kadar",
    body: "Bot yapmanın keyifsiz kısımlarını Makecord üstlenir, sen botun ne yaptığına odaklanırsın.",
    items: [
      {
        title: "Akışlar birer dosya",
        body: "Her komut ve event projende okunabilir bir JSON dosyası. Git ile versiyonla, incele, paylaş.",
      },
      {
        title: "Kaydettiğin anda canlı",
        body: "Bot çalışırken akışı değiştir, kaydedince devreye girer. Az önce çalışan blok editörde yanar.",
      },
      {
        title: "Token'ın projede durmaz",
        body: "Secret'lar sistem anahtar zincirinde şifrelenir ve sadece bot çalışırken ortam değişkeni olarak verilir.",
      },
      {
        title: "Sorunları çalıştırmadan gör",
        body: "Eksik intent, hiç çalışmayacak bir blok, yanlış yerde kullanılan bir eylem. Sorunlar paneli yakalar, çoğunu tek tıkla düzeltir.",
      },
    ],
  },
  selfHost: {
    title: "Önce bilgisayarında, sonra sunucunda",
    body: "Motor bağımsız bir npm paketi. Projeyi bir VPS'e kopyala, token'ı .env dosyasına yaz ve başlat. Docker ile tek satır.",
    body2:
      "Hesap yok, barındırma hizmeti yok. Discord API değiştiğinde motoru güncellemek bir npm update kadar kolay.",
    comment1: "# sunucunda",
    comment2: "# DISCORD_TOKEN değerini gir",
    comment3: "# ya da",
    online: "Bramble#4821 çevrimiçi · 3 sunucu",
    registered: "3 komut kaydedildi: /ping /greet /rank",
  },
  plugins: {
    title: "Eksik bir blok mu var? Yaz",
    body: "Bir plugin birkaç blok tanımı ve onları çalıştıran fonksiyonlardan ibaret. Alanlar Zod şemasıyla tanımlanır, IDE ayar formunu bunlardan kurar.",
    body2:
      "Plugin'ler sadece izin verdiğin secret'ları görür, bot token'ını asla. IDE içinde bir marketplace yolda: veritabanı ya da ekonomi sistemi eklemek tek tık olacak.",
  },
  footer: {
    docs: "Dokümantasyon",
    openSource: "Ücretsiz ve açık kaynak",
    trademark: "Discord, Discord Inc.'in ticari markasıdır. Makecord bağımsız bir projedir.",
  },
};
