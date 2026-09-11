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
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('SCAN THIS QR:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('CONNECTED SUCCESSFULLY!');
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed, reason:', reason);
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 5000);
            } else {
                console.log('Logged out, please delete session folder.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
