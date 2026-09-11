const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

global.crypto = require('crypto');

async function startBot() {
    console.log('Bot starting...');
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'fatal' }),
        
        browser: ["Mac OS", "Safari", "17.2"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('SCAN THIS QR NOW:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('CONNECTED SUCCESSFULLY!');
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed, reason:', reason);
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const chatId = mek.key.remoteJid;
            if (!chatId.endsWith('@g.us')) return;

            let text = mek.message.conversation || mek.message.extendedTextMessage?.text || '';
            text = text.trim();

            if (text === 'طرد' || text === '.طرد') {
                const quoted = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const targetId = quoted ? mek.message.extendedTextMessage.contextInfo.participant : mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (targetId) {
                    await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
                    await sock.sendMessage(chatId, { text: `تم الطرد بواسطة wel3a @${targetId.split('@')[0]}`, mentions: [targetId] });
                }
            }
        } catch (e) {}
    });
}

startBot();
