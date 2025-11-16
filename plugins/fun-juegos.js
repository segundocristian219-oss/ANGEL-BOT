// 

let handler = async  { conn, text, args }) => { const palabra = (args[0] || '').toLowerCase() const user = m.quoted ? m.quoted.sender : (m.mentionedJid && m.mentionedJid[0]) || m.sender

const nombres = conn.getName(user)

function r(a) { return a[Math.floor(Math.random() * a.length)] } function n(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

const juegos = { casar: () => 💍 *${nombres}* se casaría contigo con un *${n(10,98)}%* de probabilidad ❤️, divorcio: () => 💔 *${nombres}* tiene un *${n(1,100)}%* de probabilidades de divorcio 😂, enana: () => 🧝‍♀️ *${nombres}* mide *${(Math.random()*2).toFixed(2)}m* 🤣, enano: () => 🧝 *${nombres}* mide *${(Math.random()*2).toFixed(2)}m*, fea: () => 🤢 *${nombres}* está *${n(1,20)}%* bonita, feo: () => 😵 *${nombres}* está *${n(1,20)}%* guapo, gay: () => 🏳️‍🌈 *${nombres}* es *${n(1,100)}%* gay, lesbiana: () => 🌈 *${nombres}* es *${n(1,100)}%* lesbiana, juegos: () => r([ '🎲 Adivina un número del 1 al 10', '🪨 Piedra Papel Tijera: elige una', '🎯 Apuesta: ¿cara o sello?' ]), manca: () => 🎮 *${nombres}* es *${n(80,100)}%* manca, manco: () => 🎮 *${nombres}* es *${n(80,100)}%* manco, matrimonios: () => 💒 Nuevo matrimonio formado: Tú + *${nombres}*, meme: () => 📸 Aquí va un meme random (aquí pones tu API), pajera: () => 💦 *${nombres}* lleva *${n(1,30)}* días sin caer 😳, pajero: () => 💦 *${nombres}* lleva *${n(1,30)}* días sin caer, personalidad: () => 🧠 *${nombres}*: ${r(['Simp', 'Loco', 'Serio', 'Amargado', 'Tóxico', 'Tierna', 'Based'])}, peruana: () => 🇵🇪 *${nombres}* es *${n(1,100)}%* peruana, peruano: () => 🇵🇪 *${nombres}* es *${n(1,100)}%* peruano, poema: () => ✍️ Poema para *${nombres}*:\n"Eres caos, eres fuego,\npero aun así te quiero", ppt: () => 🪨 Resultado: ${r(['Piedra', 'Papel', 'Tijera'])}, puto: () => 🌈 *${nombres}* es *${n(1,120)}%* puto, rata: () => 🐀 *${nombres}* robó *${n(1,5)}* panes hoy, pegar: () => 👊 Le diste un madrazo a *${nombres}*, }

if (!palabra) return m.reply('🎮 Usa: .juego <palabra> @usuario')

if (!juegos[palabra]) return m.reply('❌ Esa categoría no existe')

const res = juegospalabra await conn.reply(m.chat, res, m) }

handler.help = ['juego <palabra>'] handler.tags = ['fun'] handler.command = /^(juego|casar|divorcio|enana|enano|fea|feo|gay|juegos|lesbiana|manca|manco|matrimonios|meme|pajera|pajero|personalidad|peruana|peruano|poema|ppt|puto|rata|pegar)$/i

export default handler