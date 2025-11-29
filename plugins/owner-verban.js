let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 *Ejemplo:* .verban +52 722 758 4934`);

    const number = args[0].replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Verificando si el número está baneado en WhatsApp...*`);

    let exists = false;
    let ppExists = false;
    let iqOk = false;
    let iqError = null;
    let confidence = 0;

    try {
        try {
            const res = await conn.onWhatsApp(jid);
            exists = !!(res && res[0] && res[0].exists);
        } catch (err) {
            exists = false;
        }

        if (!exists) {
            confidence = 80;
            return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *ESTADO:* NO EXISTE EN WHATSAPP / POSIBLE BLOQUEO PERMANENTE
🔎 *Confianza:* ${confidence}%`
            );
        }

        try {
            const pp = await conn.profilePictureUrl(jid, 'image');
            if (pp) ppExists = true;
        } catch (err) {
            ppExists = false;
        }

        try {
            await conn.query({
                tag: 'iq',
                attrs: { to: jid, type: 'get', xmlns: 'status' }
            });
            iqOk = true;
        } catch (err) {
            iqOk = false;
            iqError = err;
        }

        if (iqOk) {
            confidence = ppExists ? 95 : 85;
            return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO:* NO ESTÁ BANEADO
🔎 *Confianza:* ${confidence}%`
            );
        }

        const errMsg = String(iqError?.message || iqError || "");
        const statusCode = iqError?.output?.statusCode || iqError?.statusCode || null;

        const tempIndicators = [
            /temporar/i,
            /temporarily/i,
            /not-allowed/i,
            /403/,
            /forbidden/i
        ];

        const permIndicators = [
            /404/,
            /not_found/i,
            /user is not registered/i,
            /does not exist/i
        ];

        const isTemporary = tempIndicators.some(rx => rx.test(errMsg));
        const isPermanent = permIndicators.some(rx => rx.test(errMsg));

        if (isTemporary || statusCode === 403) {
            confidence = ppExists ? 85 : 75;
            return m.reply(
`📱 Número: https://wa.me/${number}

🟠 *ESTADO:* BLOQUEO TEMPORAL
🔎 *Confianza:* ${confidence}%`
            );
        }

        if (isPermanent || statusCode === 404) {
            confidence = ppExists ? 50 : 85;
            return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *ESTADO:* POSIBLE BLOQUEO PERMANENTE / NO REGISTRADO
🔎 *Confianza:* ${confidence}%`
            );
        }

        confidence = 60;
        return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *ESTADO:* INDETERMINADO
🔎 *Confianza:* ${confidence}%`
        );

    } catch (e) {
        return m.reply("❌ Ocurrió un error al verificar el número.");
    }
};

handler.command = /^verban$/i;
export default handler;