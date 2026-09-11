const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

global.crypto = require('crypto');

async function startWel3aBot() {
    console.log('=== Starting Wel3a Bot with QR Code ===');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_wel3a');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Wel3aBot", "Chrome", "10.0"]
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n========================================');
            console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP:');
            console.log('========================================\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('=== Wel3a Bot Connected Successfully! ===');
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => startWel3aBot(), 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    let punishedUsers = new Set();

    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        for (let num of participants) {
            if (action === 'add') {
                await sock.sendMessage(id, { text: `Welcome to Wel3a group @${num.split('@')[0]}`, mentions: [num] });
            } else if (action === 'remove') {
                await sock.sendMessage(id, { text: `Goodbye @${num.split('@')[0]}`, mentions: [num] });
            }
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            if (mek.key.fromMe) return;

            const chatId = mek.key.remoteJid;
            if (!chatId.endsWith('@g.us')) return;

            const senderId = mek.key.participant || mek.key.remoteJid;
            const messageType = Object.keys(mek.message)[0];
            
            let text = '';
            if (messageType === 'conversation') {
                text = mek.message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                text = mek.message.extendedTextMessage.text;
            }
            text = text ? text.trim() : '';

            if (punishedUsers.has(senderId)) {
                try {
                    await sock.sendMessage(chatId, { delete: mek.key });
                } catch (e) {}
                return;
            }

            const isQuoted = messageType === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo && mek.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedMsg = isQuoted ? mek.message.extendedTextMessage.contextInfo : null;

            if (text === '.عقاب' && quotedMsg) {
                const targetId = quotedMsg.participant;
                punishedUsers.add(targetId);
                await sock.sendMessage(chatId, { text: `Punished successfully @${targetId.split('@')[0]}`, mentions: [targetId] });
            } 
            else if (text === '.عفو' && quotedMsg) {
                const targetId = quotedMsg.participant;
                punishedUsers.delete(targetId);
                await sock.sendMessage(chatId, { text: `Pardoned successfully @${targetId.split('@')[0]}`, mentions: [targetId] });
            }
            else if (text === '.طرد' || text === 'طرد') {
                let targetId = quotedMsg ? quotedMsg.participant : null;
                if (!targetId && mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                    targetId = mek.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                if (targetId) {
                    try {
                        await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
                        await sock.sendMessage(chatId, { text: `Removed successfully @${targetId.split('@')[0]}`, mentions: [targetId] });
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.log(err);
        }
    });
}

startWel3aBot();
