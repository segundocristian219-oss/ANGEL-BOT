import { generateWAMessageFromContent } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb = null
fetch('https://i.postimg.cc/rFfVL8Ps/image.jpg')
  .then(r => r.arrayBuffer())
  .then(buf => { thumb = Buffer.from(buf) })
  .catch(() => { thumb = null })

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  const fkontak = {
    key: {
      participants: '0@s.whatsapp.net',
      remoteJid: 'status@broadcast',
      fromMe: false,
      id: 'Halo'
    },
    message: {
      locationMessage: {
        name: '𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖡𝖺𝗄𝗂-𝖡𝗈𝗍',
        jpegThumbnail: thumb,
        degreesLatitude: 19.4326,
        degreesLongitude: -99.1332
      }
    },
    participant: '0@s.whatsapp.net'
  }

  const content = (m.text || m.msg?.caption || '').trim()
  if (!/^(\.?n)(\s|$)/i.test(content)) return

  await conn.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })

  const users = participants.map(u => conn.decodeJid(u.id))
  const userText = content.replace(/^(\.?n)\s*/i, '')
  const q = m.quoted || m
  const mtype = q.mtype || ''
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mtype)
  const originalCaption = (q.msg?.caption || q.text || '').trim()
  const finalCaption = userText || originalCaption || '🔊 Notificación'
  const sendOptions = { quoted: fkontak, mentions: users }

  try {
    const tasks = []

    if (m.quoted && isMedia) {
      const media = await q.download()
      if (mtype === 'audioMessage') {
        tasks.push(conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mpeg', ptt: false, ...sendOptions }))
        if (userText) tasks.push(conn.sendMessage(m.chat, { text: `🔊 ${userText}`, ...sendOptions }))
      } else {
        const msg = { ...sendOptions }
        if (mtype === 'imageMessage') msg.image = media, msg.caption = `🔊 ${finalCaption}`
        if (mtype === 'videoMessage') msg.video = media, msg.caption = `🔊 ${finalCaption}`, msg.mimetype = 'video/mp4'
        if (mtype === 'stickerMessage') msg.sticker = media
        tasks.push(conn.sendMessage(m.chat, msg, sendOptions))
      }
    } else if (m.quoted && !isMedia) {
      const msg = conn.cMod(
        m.chat,
        generateWAMessageFromContent(
          m.chat,
          { [mtype || 'extendedTextMessage']: q.message?.[mtype] || { text: finalCaption } },
          { quoted: fkontak, userJid: conn.user.id }
        ),
        finalCaption,
        conn.user.jid,
        { mentions: users }
      )
      tasks.push(conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id }))
    } else if (!m.quoted && isMedia) {
      const media = await m.download()
      if (mtype === 'audioMessage') {
        tasks.push(conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mpeg', ptt: false, ...sendOptions }))
        if (userText) tasks.push(conn.sendMessage(m.chat, { text: `🔊 ${userText}`, ...sendOptions }))
      } else {
        const msg = { ...sendOptions }
        if (mtype === 'imageMessage') msg.image = media, msg.caption = `🔊 ${finalCaption}`
        if (mtype === 'videoMessage') msg.video = media, msg.caption = `🔊 ${finalCaption}`, msg.mimetype = 'video/mp4'
        if (mtype === 'stickerMessage') msg.sticker = media
        tasks.push(conn.sendMessage(m.chat, msg, sendOptions))
      }
    } else {
      tasks.push(conn.sendMessage(m.chat, { text: `🔊 ${finalCaption}`, ...sendOptions }))
    }

    const results = await Promise.allSettled(tasks)
    const errors = results.filter(r => r.status === 'rejected')
    if (errors.length > 0) console.warn(`[Notificación] ${errors.length} fallaron.`)
  } catch (err) {
    console.error('[Error en Notificación]', err)
    await conn.sendMessage(m.chat, { text: '🔊 Notificación', mentions: participants.map(u => u.id) }, { quoted: fkontak })
  }
}

handler.customPrefix = /^(\.?n)(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler