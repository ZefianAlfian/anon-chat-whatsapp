// panggil konfigurasi di file .env
require("dotenv").config();
// Panggil library
const { WAConnection, MessageType } = require("@adiwajshing/baileys");
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
const helper = require("./helper/helper");

// nganbil prefix
const prefix = process.env.PREFIX;
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

    fs.writeFileSync(
      "./bot_session.json",
      JSON.stringify(authinfo, null, "\t")
    );
  });

  fs.existsSync("./bot_session.json") && zef.loadAuthInfo("./bot_session.json");

  zef.on("connecting", () => {
    console.log("Connecting");
  });
  zef.on("open", () => {
    console.log("Bot Is Online Now!!");
  });
  zef.connect();

  zef.on("chat-update", async (msg) => {
    try {
      // Jika tidak menerima pesan baru
      if (!msg.hasNewMessage) return;
      msg = JSON.parse(JSON.stringify(msg)).messages[0];

      if (!msg.message) return;
      if (msg.key && msg.key.remoteJid == "status@broadcast") return;

      global.prefix;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const type = Object.keys(msg.message)[0];
      const id = isGroup ? msg.participant : msg.key.remoteJid;

      const { text } = MessageType;

      body =
        type === "conversation" && msg.message.conversation.startsWith(prefix)
          ? msg.message.conversation
          : type == "imageMessage" &&
            msg.message.imageMessage.caption.startsWith(prefix)
          ? msg.message.imageMessage.caption
          : type == "videoMessage" &&
            msg.message.videoMessage.caption.startsWith(prefix)
          ? msg.message.videoMessage.caption
          : type == "extendedTextMessage" &&
            msg.message.extendedTextMessage.text.startsWith(prefix)
          ? msg.message.extendedTextMessage.text
          : "";

      const argv = body.slice(1).trim().split(/ +/).shift().toLowerCase();
      const args = body.trim().split(/ +/).slice(1);
      const isCmd = body.startsWith(prefix);
      const totalchat = await zef.chats.all();

      const groupMetadata = isGroup ? await zef.groupMetadata(from) : "";
      const groupName = isGroup ? groupMetadata.subject : "";
      const groupId = isGroup ? groupMetadata.jid : "";
      const isMedia =
        type === "imageMessage" ||
        type === "videoMessage" ||
        type === "audioMessage";

      const content = JSON.stringify(msg.message);

      const isQuotedImage =
        type === "extendedTextMessage" && content.includes("imageMessage");
      const isQuotedVideo =
        type === "extendedTextMessage" && content.includes("videoMessage");
      const isQuotedAudio =
        type === "extendedTextMessage" && content.includes("audioMessage");
      const isQuotedSticker =
        type === "extendedTextMessage" && content.includes("stickerMessage");
      const isQuotedMessage =
        type === "extendedTextMessage" && content.includes("conversation");

      if (isGroup) return;

      if (isCmd) {
        switch (argv) {
          case "help":
            zef.sendMessage(
              from,
              "Hai teman, Fitur :\n/help\n/start\n/find\n/stop",
              text,
              { quoted: msg }
            );
            break;
          case "find":
            if (isGroup) return zef.chatRead(msg.key.remoteJid);
            // Fungsi untuk mencari partner
            const isActiveSess = await helper.isActiveSession(
              id,
              zef,
              MessageType.text
            );
            // Apakah user sudah punya sesi chatting ?
            if (!isActiveSess) {
              await zef.sendMessage(id, "Kegagalan Server!", MessageType.text);
            }

            // Apakah user udah ada di antrian ?
            const isQueue = await queue.find({ user_id: id });
            console.log(isQueue);
            if (!isQueue.length) {
              // Kalo gak ada masukin ke antrian
              await queue.insert({
                user_id: id,
                timestamp: parseInt(moment().format("X")),
              });
            }
            // Kirim pesan kalo lagi nyari partner
            zef.sendMessage(id, "Mencari Partner Chat ...", MessageType.text);
            // apakah ada user lain yang dalam antrian ?
            var queueList = await queue.find({
              user_id: { $not: { $eq: id } },
            });
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
              await zef.sendMessage(
                id,
                "Kamu Menemukan Partner chat\nSegera Kirim Pesan",
                MessageType.text
              );
            }
            break;
          case "stop":
            const searchActiveSess = await helper.isActiveSession(id, zef);
            if (searchActiveSess) {
              // kalo ada hapus sesi nya
              await zef.sendMessage(
                id,
                "Kamu telah berhenti chatting dengan partnermu \n ketik /find untuk mulai mencari partner baru",
                MessageType.text
              );
            } else if (!searchActiveSess) {
              // Kalo gak ada hapus data kamu dalam antrian
              const queueData = await queue.findOne({ user_id: id });
              await queue.remove({ id: queueData.id });
              await zef.sendMessage(
                id,
                "Kamu telah berhenti mencari partner \n ketik /find untuk mulai mencari partner",
                MessageType.text
              );
            }
            break;
          default:
            break;
        }
      } else {
        if (msg.key.fromMe) return;

        console.log(`mendapat pesan dari ${id}`);
        // Nah ini buat saling balas-balasan sama partner kamu

        // Cek dulu , kamu ada partner apa enggak
        const isActiveSess = await active_sessions.findOne({
          $or: [{ user1: id }, { user2: id }],
        });

        if (isActiveSess !== null) {
          // Nah kalo ada ambil data sesi chatting nya
          const session = await active_sessions.findOne({
            $or: [{ user1: id }, { user2: id }],
          });
          const { user1, user2 } = session;
          // Ini buat ngamil user id partner kamu
          const target = user1 == id ? user2 : user1;

          if (!msg.message.conversation) return;

          zef.sendMessage(target, msg.message.conversation, MessageType.text);
        } else {
          // Ini kalo kamu gak punya partner chatting
          await zef.sendMessage(
            id,
            "Kamu belum punya partner chatting \nketik /find untuk mencari partner chatting",
            MessageType.text
          );
        }
      }
    } catch (error) {
      console.log(error);
    }
  });
}

starts();
