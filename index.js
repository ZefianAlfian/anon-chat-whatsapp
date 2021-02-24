// panggil konfigurasi di file .env
require("dotenv").config();
// Panggil library
const {
  ChatModification,
  WAConnection,
  MessageType,
  Presence,
  MessageOptions,
  Mimetype,
  WALocationMessage,
  WA_MESSAGE_STUB_TYPES,
  ReconnectMode,
  ProxyAgent,
  waChatKey,
  GroupSettingChange,
} = require("@adiwajshing/baileys");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
// Ngambil collections di Database
const { queue, active_sessions } = require("./config/database");

//Fimgsi handler
const handler = {
  error: "Terjadi error, report ke admin !!",
  sukses: "Berhasil !!",
  diGrup: "Kamu berada di grup, tidak bisa menggunakan anonymous chat !!",
};
// Fungsi Helper
const { helper } = require("./helper/helper");

// nganbil prefix
const prefix = process.env.PREFIX;
console.log(prefix);
// Moment buat ngambil tanggal
const moment = require("moment");

// Start Pooling bot
// lakukan fungsi di bawah kalo ada pesan ke bot
async function starts() {
  const zef = new WAConnection();
  zef.logger.level = "warn";

  zef.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log(`[!] Scan qrcode dengan whatsapp`);
  });

  zef.on("credentials-updated", () => {
    const authinfo = zef.base64EncodedAuthInfo();
    console.log("[!] Credentials Updated");

    fs.writeFileSync("./rizqi.json", JSON.stringify(authinfo, null, "\t"));
  });

  fs.existsSync("./rizqi.json") && zef.loadAuthInfo("./rizqi.json");

  zef.on("connecting", () => {
    console.log("Connecting");
  });
  zef.on("open", () => {
    console.log("Bot Is Online Now!!");
  });
  zef.connect();

  zef.on("chat-update", async (msg) => {
    try {
      if (!msg.hasNewMessage) return;
      msg = JSON.parse(JSON.stringify(msg)).messages[0];
      if (!msg.message) return;
      if (msg.key && msg.key.remoteJid == "status@broadcast") return;
      //ini adalah self bot
      //if (msg.key.fromMe) return
      global.prefix;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const type = Object.keys(msg.message)[0];
      const id = isGroup ? msg.participant : msg.key.remoteJid;

      const {
        text,
        extendedText,
        contact,
        location,
        liveLocation,
        image,
        video,
        sticker,
        document,
        audio,
        product,
      } = MessageType;

      body = type === "conversation" && msg.message.conversation.startsWith(prefix) ? msg.message.conversation : type == "imageMessage" && msg.message.imageMessage.caption.startsWith(prefix) ? msg.message.imageMessage.caption : type == "videoMessage" && msg.message.videoMessage.caption.startsWith(prefix) ? msg.message.videoMessage.caption : type == "extendedTextMessage" && msg.message.extendedTextMessage.text.startsWith(prefix) ? msg.message.extendedTextMessage.text : "";
      budy =
        type === "conversation"
          ? msg.message.conversation
          : type === "extendedTextMessage"
          ? msg.message.extendedTextMessage.text
          : "";

      const argv = body.slice(1).trim().split(/ +/).shift().toLowerCase();
      const args = body.trim().split(/ +/).slice(1);
      const isCmd = body.startsWith(prefix);
	  const totalchat = await zef.chats.all()

      const groupMetadata = isGroup ? await zef.groupMetadata(from) : "";
      const groupName = isGroup ? groupMetadata.subject : "";
      const groupId = isGroup ? groupMetadata.jid : "";
      const isMedia = type === "imageMessage" || type === "videoMessage" || type === "audioMessage";

      const content = JSON.stringify(msg.message);

      const isQuotedImage = type === "extendedTextMessage" && content.includes("imageMessage");
	  const isQuotedVideo =
        type === "extendedTextMessage" && content.includes("videoMessage");
      const isQuotedAudio =
        type === "extendedTextMessage" && content.includes("audioMessage");
      const isQuotedSticker =
        type === "extendedTextMessage" && content.includes("stickerMessage");
      const isQuotedMessage =
        type === "extendedTextMessage" && content.includes("conversation");

      //Function

	  if(isCmd) console.log(`${id.split('@')[0]} menggunakan bot, command nya ${argv}`)
      switch (argv) {
		case "help":
			//if (isGroup) return zef.chatRead(msg.key.remoteJid)
			zef.sendMessage(from, "Hai teman, Fitur :\n/help\n/start\n/find\n/stop", text, {quoted:msg})
        case "start":
			if (isGroup) return zef.chatRead(msg.key.remoteJid)
          // Pesan Penyambutan :)
          zef.sendMessage(id,"Selamat Datang di Anonim Chat bot\n bot yang digunakan untuk chatting secara anonim buatan Rizqi / Zefian", text, {quoted:msg});
          break;
        case "find":
			if (isGroup) return zef.chatRead(msg.key.remoteJid)
          // Fungsi untuk mencari partner
          const isActiveSess = helper.isActiveSession(id, bot);
          // Apakah user sudah punya sesi chatting ?
          if (!isActiveSess) {
            await bot.sendMessage(id, "Kegagalan Server!");
          }

          // Apakah user udah ada di antrian ?
          const isQueue = await queue.find({ user_id: id });
          if (!isQueue.length) {
            // Kalo gak ada masukin ke antrian
            await queue.insert({
              user_id: id,
              timestamp: parseInt(moment().format("X")),
            });
          }
          // Kirim pesan kalo lagi nyari partner
          bot.sendMessage(id, "<i>Mencari Partner Chat ...</i>", {
            parse_mode: "html",
          });
          // apakah ada user lain yang dalam antrian ?
          var queueList = await queue.find({ user_id: { $not: { $eq: id } } });
          // Selama gak ada user dalam antrian , cari terus boss
          while (queueList.length < 1) {
            queueList = await queue.find({ user_id: { $not: { $eq: id } } });
          }

          // Nah dah ketemu nih , ambil user id dari partner
          const partnerId = queueList[0].user_id;
          // Ini ngamdil data antrian kamu
          const you = await queue.findOne({ user_id: id });
          // Ini ngamdil data antrian partner kamu
          const partner = await queue.findOne({ user_id: partnerId });

          // Kalo data antrian kamu belum di apus (atau belum di perintah /stop)
          if (you !== null) {
            // apakah kamu duluan yang nyari partner atau partnermu
            if (you.timestamp < partner.timestamp) {
              // kalo kamu duluan kamu yang mulai sesi , partner mu cuma numpang
              await active_sessions.insert({ user1: id, user2: partnerId });
            }
            // Hapus data kamu sama partnermu dalam antrian
            for (let i = 0; i < 2; ++i) {
              const data = await queue.find({
                user_id: i > 0 ? partnerId : id,
              });
              await queue.remove({ id: data.id });
            }

            // Kirim pesan ke kamu kalo udah nemu partner
            await bot.sendMessage(
              id,
              "Kamu Menemukan Partner chat\nSegera Kirim Pesan"
            );
          }
		  break
		
		case "eval":
			const q = body.slice(5)
			try {
				let evaled = await eval(q)
				if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
				zef.sendMessage(from, evaled, text, {quoted:msg})
			} catch (e){
				console.log(e);
				zef.sendMessage(from, e, text, {quoted:msg})
			}
      }
    } catch (e) {
      console.log(e);
    }
  });
}
starts();
