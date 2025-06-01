const { PREFIX } = require(`${BASE_DIR}/config`);
const { attp } = require(`${BASE_DIR}/services/spider-x-api`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);

module.exports = {
  name: "attp",
  description: "Faz figurinhas animadas de texto.",
  commands: ["attp"],
  usage: `${PREFIX}attp teste`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    sendWaitReact,
    args,
    sendStickerFromURL,
    sendSuccessReact,
  }) => {
    if (!args.length) {
      throw new InvalidParameterError(
        "Você precisa informar o texto que deseja transformar em figurinha."
      );
    }

    await sendWaitReact();

    const url = await attp(args[0].trim());

    await sendSuccessReact();

    await sendStickerFromURL(url);
  },
};
