let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 *Ejemplo:* .verban 527227584934`);

    let number = args[0].replace(/\D/g, "");
    let jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Verificando si el número está baneado en WhatsApp...*`);

    try {
        let exists = false;

        try {
            let res = await conn.onWhatsApp(jid);
            exists = res && res[0] && res[0].exists;
        } catch {}

        if (!exists) return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *ESTADO:* EL NÚMERO NO EXISTE O ESTÁ BANEADO PERMANENTEMENTE`
        );

        try {
            await conn.query({
                tag: 'iq',
                attrs: { to: jid, type: 'get', xmlns: 'status' }
            });

            return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO:* NO ESTÁ BANEADO`
            );
        } catch (err) {
            if (err?.output?.statusCode === 403 || err?.message?.includes('not-allowed') || err?.message?.includes('temporarily')) {
                return m.reply(
`📱 Número: https://wa.me/${number}

🟠 *ESTADO:* BLOQUEO TEMPORAL`
                );
            } else {
                return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *ESTADO:* POSIBLE BLOQUEO PERMANENTE`
                );
            }
        }

    } catch (e) {
        console.log(e);
        return m.reply("❌ Ocurrió un error al verificar el número.");
    }
};

handler.command = /^verban$/i;
export default handler;