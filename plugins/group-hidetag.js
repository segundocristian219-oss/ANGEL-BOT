import fetch from 'node-fetch'

let thumb
fetch('https://i.postimg.cc/rFfVL8Ps/image.jpg')
  .then(r => r.arrayBuffer())
  .then(buf => thumb = Buffer.from(buf))
  .catch(() => thumb = null)

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  const fkontak = {
    key: { participants: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'Halo' },
    message: { locationMessage: { name: '𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖡𝖺𝗄𝗂-𝖡𝗈𝗍', jpegThumbnail: thumb } },
    participant: '0@s.whatsapp.net'
  }

  const content = m.text || m.msg?.caption || ''
  if (!/^(\.n|n)\b/i.test(content.trim())) return

  await conn.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })

  const users = participants.map(u => conn.decodeJid(u.id))
  const userText = content.trim().replace(/^(\.n|n)\b\s*/i, '')
  const finalText = userText || '🔊 Notificación'

  const q = m.quoted ? m.quoted : null
  const mtype = q?.mtype || ''
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(mtype)

  try {
    if (q && q.message) {
      let success = true
      try {
        await conn.copyNForward(m.chat, q, true, { quoted: fkontak, mentions: users })
      } catch {
        success = false
      }

      if (!success && isMedia) {
        const media = await q.download()
        const msg = { mentions: users }
        if (mtype === 'stickerMessage') msg.sticker = media
        if (mtype === 'imageMessage') msg.image = media, msg.caption = finalText
        if (mtype === 'videoMessage') msg.video = media, msg.caption = finalText
        if (mtype === 'audioMessage') msg.audio = media, msg.mimetype = 'audio/mpeg', msg.ptt = false
        if (mtype === 'documentMessage') msg.document = media, msg.fileName = q.msg.fileName || 'file'
        await conn.sendMessage(m.chat, msg, { quoted: fkontak })
      } else if (finalText && finalText !== '🔊 Notificación') {
        if (mtype !== 'imageMessage' && mtype !== 'videoMessage') {
          await conn.sendMessage(m.chat, { text: finalText, mentions: users }, { quoted: fkontak })
        }
      }
    } else {
      await conn.sendMessage(m.chat, { text: finalText, mentions: users }, { quoted: fkontak })
    }
  } catch {
    await conn.sendMessage(m.chat, { text: finalText, mentions: users }, { quoted: fkontak })
  }
}

handler.customPrefix = /^(\.n|n)\b/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler