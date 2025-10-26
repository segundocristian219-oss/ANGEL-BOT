import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Russellxz"

const pending = {}
const cache = {}
const MAX_CONCURRENT = 3
let activeDownloads = 0
const downloadQueue = []

let isDownloadingAudio = false
let isDownloadingVideo = false
const audioQueue = []
const videoQueue = []

function safeUnlink(file) {
  if (!file) return
  try { fs.existsSync(file) && fs.unlinkSync(file) } catch {}
}

function fileSizeMB(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024)
}

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) {
    await new Promise(resolve => downloadQueue.push(resolve))
  }
  activeDownloads++
  try {
    return await task()
  } finally {
    activeDownloads--
    if (downloadQueue.length) downloadQueue.shift()()
  }
}

async function queueTypeDownload(type, task) {
  if (type === "audio") audioQueue.push(task)
  else videoQueue.push(task)

  while ((type === "audio" && isDownloadingVideo) || (type === "video" && isDownloadingAudio)) {
    await new Promise(r => setTimeout(r, 500))
  }

  if (type === "audio") {
    isDownloadingAudio = true
    const t = audioQueue.shift()
    await t()
    isDownloadingAudio = false
    if (audioQueue.length) await queueTypeDownload("audio", audioQueue[0])
  } else {
    isDownloadingVideo = true
    const t = videoQueue.shift()
    await t()
    isDownloadingVideo = false
    if (videoQueue.length) await queueTypeDownload("video", videoQueue[0])
  }
}

async function downloadToFile(url, filePath, timeout = 60000) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout,
    headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10; WhatsAppBot)" }
  })
  await streamPipe(res.data, fs.createWriteStream(filePath))
  return filePath
}

async function getSkyApiUrl(videoUrl, format, timeout = 20000) {
  try {
    const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
      params: { url: videoUrl, format },
      headers: { Authorization: `Bearer ${SKY_KEY}` },
      timeout
    })
    const result = data?.data || data
    const url = result?.audio || result?.video || result?.url || result?.download
    if (!url || !url.startsWith("http")) throw new Error("URL inválida de SKY API")
    return url
  } catch {
    return null
  }
}

async function convertToMp3(inputFile) {
  const outFile = inputFile.replace(/_in\.\w+$/, "_out.mp3")
  await new Promise((resolve, reject) =>
    ffmpeg(inputFile)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .save(outFile)
      .on("end", resolve)
      .on("error", reject)
  )
  safeUnlink(inputFile)
  return outFile
}

async function prepareFormats(videoUrl, id) {
  const groups = [
    [
      { key: "audio", format: "audio", ext: "mp3" },
      { key: "video", format: "video", ext: "mp4" }
    ],
    [
      { key: "audioDoc", format: "audio", ext: "mp3" },
      { key: "videoDoc", format: "video", ext: "mp4" }
    ]
  ]

  cache[id] = { timestamp: Date.now(), files: {} }

  for (const group of groups) {
    await Promise.all(group.map(async f => {
      const mediaUrl = await getSkyApiUrl(videoUrl, f.format)
      if (!mediaUrl) return
      const unique = crypto.randomUUID()
      const file = path.join(TMP_DIR, `${unique}_${f.key}.${f.ext}`)
      await queueTypeDownload(f.key.startsWith("audio") ? "audio" : "video", async () => downloadToFile(mediaUrl, file))
      cache[id].files[f.key] = file
    }))
  }
}

async function sendFile(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!fs.existsSync(filePath)) return
  const buffer = fs.readFileSync(filePath)
  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4"
  const fileName = `${title}.${type === "audio" ? "mp3" : "mp4"}`
  await conn.sendMessage(chatId, {
    [asDocument ? "document" : type]: buffer,
    mimetype,
    fileName
  }, { quoted })
}

async function handleDownload(conn, job, choice) {
  const mapping = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc" }
  const key = mapping[choice]
  if (!key) return
  const isDoc = key.endsWith("Doc")
  const type = key.startsWith("audio") ? "audio" : "video"
  let filePath
  try {
    const cached = cache[job.commandMsg.key.id]?.files?.[key]
    if (cached && fs.existsSync(cached)) {
      const size = fileSizeMB(cached).toFixed(1)
      await conn.sendMessage(job.chatId, { text: `⚡ Enviando ${type} (${size} MB)` }, { quoted: job.commandMsg })
      await sendFile(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
      return
    }
    await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${isDoc ? "documento" : type}...` }, { quoted: job.commandMsg })
    const mediaUrl = await getSkyApiUrl(job.videoUrl, type)
    if (!mediaUrl) throw new Error("No se obtuvo enlace válido de SKY API")
    const ext = type === "audio" ? "mp3" : "mp4"
    const unique = crypto.randomUUID()
    const inFile = path.join(TMP_DIR, `${unique}_in.${ext}`)
    filePath = inFile
    await queueTypeDownload(type, async () => downloadToFile(mediaUrl, inFile))
    if (type === "audio" && !inFile.endsWith(".mp3")) filePath = await convertToMp3(inFile)
    await sendFile(conn, job.chatId, filePath, job.title, isDoc, type, job.commandMsg)
  } catch (err) {
    await conn.sendMessage(job.chatId, { text: `❌ Error: ${err.message}` }, { quoted: job.commandMsg })
  } finally {
    safeUnlink(filePath)
  }
}

const handler = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || "."
  if (!text?.trim()) return conn.sendMessage(msg.key.remoteJid, { text: `✳️ Usa:\n${pref}play <término>` }, { quoted: msg })

  await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } })
  const res = await yts(text)
  const video = res.videos?.[0]
  if (!video) return conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg })
  
  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video
  const viewsFmt = (views || 0).toLocaleString()
  const caption = `
𝚂𝚄𝙿𝙴𝚁 𝙿𝙻𝙰𝚈
🎵 𝚃𝚒́𝚝𝚞𝚕𝚘: ${title}
🕑 𝙳𝚞𝚛𝚊𝚌𝚒𝚘́𝚗: ${duration}
👁️‍🗨️ 𝚅𝚒𝚜𝚝𝚊𝚜: ${viewsFmt}
🎤 𝙰𝚛𝚝𝚒𝚜𝚝𝚊: ${author?.name || author || "Desconocido"}
🌐 𝙻𝚒𝚗𝚔: ${videoUrl}

📥 Opciones de descarga (usa reacciones):
☛ 👍 Audio MP3
☛ ❤️ Video MP4
☛ 📄 Audio Doc
☛ 📁 Video Doc
`.trim()
  
  const preview = await conn.sendMessage(msg.key.remoteJid, { image: { url: thumbnail }, caption }, { quoted: msg })

  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    sender: msg.key.participant || msg.participant,
    downloading: false
  }

  prepareFormats(videoUrl, preview.key.id)
  setTimeout(() => delete pending[preview.key.id], 20 * 24 * 60 * 60 * 1000)

  if (!conn._playListener) {
    conn._playListener = true
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages) {
        if (!m.message?.reactionMessage) continue
        const { key: reactKey, text: emoji, sender } = m.message.reactionMessage
        const job = pending[reactKey.id]
        if (!job || !["👍","❤️","📄","📁"].includes(emoji)) continue
        const reactor = sender || m.key.participant
        if (reactor !== job.sender) {
          await conn.sendMessage(job.chatId, { text: "❌ Solo quien solicitó el comando puede usar las reacciones." }, { quoted: job.commandMsg })
          continue
        }
        if (job.downloading) continue
        job.downloading = true
        try { await handleDownload(conn, job, emoji) } finally { job.downloading = false }
      }
    })
  }
}

const CACHE_LIFETIME = 20 * 24 * 60 * 60 * 1000
const MAX_TMP_SIZE_MB = 500

setInterval(() => {
  const now = Date.now()
  for (const [id, data] of Object.entries(cache)) {
    if (now - data.timestamp > CACHE_LIFETIME) {
      for (const f of Object.values(data.files)) safeUnlink(f)
      delete cache[id]
    }
  }
  const files = fs.readdirSync(TMP_DIR).map(name => {
    const f = path.join(TMP_DIR, name)
    const stats = fs.statSync(f)
    return { path: f, time: stats.mtimeMs, size: stats.size }
  })
  const totalSizeMB = files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)
  if (totalSizeMB > MAX_TMP_SIZE_MB) {
    const toDelete = files.sort((a, b) => a.time - b.time).slice(0, Math.floor(files.length / 2))
    for (const f of toDelete) safeUnlink(f.path)
  }
}, 10 * 60 * 1000)

handler.command = ["play"]
export default handler