const { PREFIX } = require(`${BASE_DIR}/config`);
const { isBotAdmin } = require(`${BASE_DIR}/middlewares`);
const { isGroup } = require(`${BASE_DIR}/utils`);
const { errorLog } = require(`${BASE_DIR}/utils/logger`);

module.exports = {
  name: "promover",
  description: "Promove um usuário a administrador do grupo",
  commands: ["promover", "promove", "promote", "add-adm"],
  usage: `${PREFIX}promover @usuario`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    args,
    remoteJid,
    socket,
    sendWarningReply,
    sendSuccessReply,
    sendErrorReply,
  }) => {
    if (!isGroup(remoteJid)) {
      return sendWarningReply("Este comando só pode ser usado em grupo !");
    }

    if (!args.length || !args[0]) {
      return sendWarningReply("Por favor, marque um usuário para promover.");
    }

    if (!(await isBotAdmin({ remoteJid, socket }))) {
      return sendWarningReply(
        "Eu preciso ser administrador do grupo para promover outros membros !"
      );
    }

    const userId = args[0].replace("@", "") + "@s.whatsapp.net";

    try {
      await socket.groupParticipantsUpdate(remoteJid, [userId], "promote");
      await sendSuccessReply("Usuário promovido com sucesso!");
    } catch (error) {
      errorLog(`Erro ao promover usuário: ${error.message}`);
      await sendErrorReply("Ocorreu um erro ao tentar promover o usuário.");
    }
  },
};
