const { Telegraf } = require("telegraf");
const SpottyDL = require("spottydl");
const fs = require("fs");
const path = require("path");
const os = require("os");
require("dotenv").config();

// Bot tokeningizni shu yerga qo'ying (BotFather'dan olingan)
const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new Telegraf(BOT_TOKEN);

// Vaqtinchalik fayllar saqlanadigan papka
const DOWNLOAD_DIR = path.join(os.tmpdir(), "spotify-bot-downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

bot.start(async (ctx) => {
  await ctx.replyWithHTML(
    `👋 <b>Assalomu alaykum! <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a></b>\nSpotifydan musiqa yuklab beruvchi botman. Spotify havolasini yuboring!`,
  );
});

// Foydalanuvchi Spotify havolasini yuborganda ishlaydigan funksiya
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  // Spotify havolasini tekshirish (track, album yoki playlist)
  const spotifyRegex =
    /(https?:\/\/open\.spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+)/;
  const match = text.match(spotifyRegex);

  if (!match) {
    return ctx.reply(
      "Iltimos, to‘g‘ri Spotify havolasini yuboring (trek, albom yoki pleylist).",
    );
  }

  const spotifyUrl = match[1];
  const statusMsg = await ctx.reply(
    "⏳ Musiqa qidirilmoqda va yuklab olinmoqda, iltimos kuting...",
  );

  try {
    // 1. Havola turiga qarab ma'lumot olish
    let trackInfo;
    if (spotifyUrl.includes("/track/")) {
      trackInfo = await SpottyDL.getTrack(spotifyUrl);
    } else if (spotifyUrl.includes("/album/")) {
      // Albom bo'lsa, birinchi trekni olamiz (yoki barchasini yuklash mumkin)
      const album = await SpottyDL.getAlbum(spotifyUrl);
      trackInfo = album.tracks[0]; // Soddalik uchun faqat birinchi trek
    } else if (spotifyUrl.includes("/playlist/")) {
      const playlist = await SpottyDL.getPlaylist(spotifyUrl);
      trackInfo = playlist.tracks[0]; // Soddalik uchun faqat birinchi trek
    }

    if (!trackInfo) {
      throw new Error("Trek ma’lumotlari topilmadi.");
    }

    // 2. Trekni yuklab olish
    const downloadResult = await SpottyDL.downloadTrack(
      trackInfo,
      DOWNLOAD_DIR,
    );

    if (downloadResult[0].status !== "Success") {
      throw new Error("Yuklab olishda xatolik yuz berdi.");
    }

    const filePath = downloadResult[0].filename;

    // 3. Yuklangan MP3 faylni foydalanuvchiga yuborish
    await ctx.replyWithAudio({
      source: fs.createReadStream(filePath),
      filename: path.basename(filePath),
    });

    // 4. Holat xabarini o'chirish va vaqtinchalik faylni tozalash
    await ctx.deleteMessage(statusMsg.message_id);
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Xatolik:", error);
    await ctx.deleteMessage(statusMsg.message_id);
    await ctx.reply(`❌ Xatolik yuz berdi: ${error.message}`);
  }
});

// Botni ishga tushirish
bot.launch().then(() => {
  console.log("✅ Spotify yuklovchi bot ishga tushdi!");
});

// To'xtatish signali (Ctrl+C)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
