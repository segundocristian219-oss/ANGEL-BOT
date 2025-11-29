let handler = async (m, { conn, args }) => {
    if (!args[0]) {
        return m.reply(`⚠️ *Falta el número*\n\n📌 *Ejemplo:* .verban 50588667711`);
    }

    let number = args[0].replace(/\D/g, "");
    let full = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Verificando si el número está baneado en WhatsApp...*`);

    try {
        let result = await conn.onWhatsApp(number);

        if (!result || !result[0] || !result[0].exists) {
            return m.reply(
`📱 Número: wa.me/${number}

🔴 *ESTADO:* EL NÚMERO PARECE ESTAR BANEADO / NO EXISTE`
            );
        }

        return m.reply(
`📱 *Número:* https://wa.me/${number}

🟢 *ESTADO: NO ESTÁ BANEADO*

Esse número não está banido do WhatsApp.`
        );

    } catch (e) {
        console.log(e);
        return m.reply("❌ Ocurrió un error al verificar el número.");
    }
};

handler.command = /^verban$/i;
export default handler;