const { PREFIX } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const fs = require("fs");
const { canvas } = require(`${BASE_DIR}/services/spider-x-api`);
const { catBoxUpload } = require(`${BASE_DIR}/services/catbox`);
const { getRandomNumber } = require(`${BASE_DIR}/utils`);

module.exports = {
  name: "rip",
  description:
    "Gero uma montagem estilo cova de cemitério com a imagem que você enviar",
  commands: ["rip"],
  usage: `${PREFIX}rip (marque a imagem) ou ${PREFIX}rip (responda a imagem)`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    isImage,
    downloadImage,
    sendSuccessReact,
    sendWaitReact,
    sendImageFromURL,
    webMessage,
  }) => {
    if (!isImage) {
      throw new InvalidParameterError(
        "Você precisa marcar uma imagem ou responder a uma imagem"
      );
    }

    await sendWaitReact();

    const filePath = await downloadImage(
      webMessage,
      `${getRandomNumber(10_000, 99_999)}`
    );

    const buffer = fs.readFileSync(filePath);
    const link = await catBoxUpload(buffer);
    const url = canvas("rip", link);

    await sendSuccessReact();

    await sendImageFromURL(url, "Imagem gerada!");

    fs.unlinkSync(filePath);
  },
};
