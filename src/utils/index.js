/**
 * Funções diversas.
 *
 * @author Dev Gui
 */
const { downloadContentFromMessage, delay } = require("baileys");
const { PREFIX, COMMANDS_DIR, TEMP_DIR, ASSETS_DIR } = require("../config");
const path = require("node:path");
const fs = require("node:fs");
const { writeFile } = require("fs/promises");
const readline = require("node:readline");
const axios = require("axios");
const { errorLog } = require("./logger");

exports.question = (message) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(message, resolve));
};

exports.extractDataFromMessage = (webMessage) => {
  const textMessage = webMessage.message?.conversation;
  const extendedTextMessage = webMessage.message?.extendedTextMessage;
  const extendedTextMessageText = extendedTextMessage?.text;
  const imageTextMessage = webMessage.message?.imageMessage?.caption;
  const videoTextMessage = webMessage.message?.videoMessage?.caption;

  const fullMessage =
    textMessage ||
    extendedTextMessageText ||
    imageTextMessage ||
    videoTextMessage;

  if (!fullMessage) {
    return {
      args: [],
      commandName: null,
      fullArgs: null,
      fullMessage: null,
      isReply: false,
      prefix: null,
      remoteJid: null,
      replyJid: null,
      userJid: null,
    };
  }

  const isReply =
    !!extendedTextMessage && !!extendedTextMessage.contextInfo?.quotedMessage;

  const replyJid =
    !!extendedTextMessage && !!extendedTextMessage.contextInfo?.participant
      ? extendedTextMessage.contextInfo.participant
      : null;

  const userJid = webMessage?.key?.participant?.replace(
    /:[0-9][0-9]|:[0-9]/g,
    ""
  );

  const [command, ...args] = fullMessage.split(" ");
  const prefix = command.charAt(0);

  const commandWithoutPrefix = command.replace(new RegExp(`^[${PREFIX}]+`), "");

  return {
    args: this.splitByCharacters(args.join(" "), ["\\", "|", "/"]),
    commandName: this.formatCommand(commandWithoutPrefix),
    fullArgs: args.join(" "),
    fullMessage,
    isReply,
    prefix,
    remoteJid: webMessage?.key?.remoteJid,
    replyJid,
    userJid,
  };
};

exports.splitByCharacters = (str, characters) => {
  characters = characters.map((char) => (char === "\\" ? "\\\\" : char));
  const regex = new RegExp(`[${characters.join("")}]`);

  return str
    .split(regex)
    .map((str) => str.trim())
    .filter(Boolean);
};

exports.formatCommand = (text) => {
  return this.onlyLettersAndNumbers(
    this.removeAccentsAndSpecialCharacters(text.toLocaleLowerCase().trim())
  );
};

exports.isGroup = (remoteJid) => {
  return remoteJid.endsWith("@g.us");
};

exports.onlyLettersAndNumbers = (text) => {
  return text.replace(/[^a-zA-Z0-9]/g, "");
};

exports.removeAccentsAndSpecialCharacters = (text) => {
  if (!text) return "";

  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

exports.baileysIs = (webMessage, context) => {
  return !!this.getContent(webMessage, context);
};

exports.getContent = (webMessage, context) => {
  return (
    webMessage.message?.[`${context}Message`] ||
    webMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.[
      `${context}Message`
    ]
  );
};

exports.download = async (webMessage, fileName, context, extension) => {
  const content = this.getContent(webMessage, context);

  if (!content) {
    return null;
  }

  const stream = await downloadContentFromMessage(content, context);

  let buffer = Buffer.from([]);

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  const filePath = path.resolve(TEMP_DIR, `${fileName}.${extension}`);

  await writeFile(filePath, buffer);

  return filePath;
};

function readDirectoryRecursive(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of list) {
    const itemPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...readDirectoryRecursive(itemPath));
    } else if (
      !item.name.startsWith("_") &&
      (item.name.endsWith(".js") || item.name.endsWith(".ts"))
    ) {
      results.push(itemPath);
    }
  }

  return results;
}

exports.findCommandImport = (commandName) => {
  const command = this.readCommandImports();

  let typeReturn = "";
  let targetCommandReturn = null;

  for (const [type, commands] of Object.entries(command)) {
    if (!commands.length) {
      continue;
    }

    try {
      const targetCommand = commands.find((cmd) => {
        if (!cmd?.commands || !Array.isArray(cmd.commands)) {
          errorLog(
            `Erro no comando do tipo "${type}": A propriedade "commands" precisa existir ser um ["array"] com os nomes dos comandos! Arquivo errado: ${cmd.name}.js`
          );

          return false;
        }

        return cmd.commands
          .map((cmdName) => this.formatCommand(cmdName))
          .includes(commandName);
      });

      if (targetCommand) {
        typeReturn = type;
        targetCommandReturn = targetCommand;
        break;
      }
    } catch (error) {
      console.error(`Erro ao processar comandos do tipo "${type}":`, error);
    }
  }

  return {
    type: typeReturn,
    command: targetCommandReturn,
  };
};

exports.readCommandImports = () => {
  const subdirectories = fs
    .readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((directory) => directory.isDirectory())
    .map((directory) => directory.name);

  const commandImports = {};

  for (const subdir of subdirectories) {
    const subdirectoryPath = path.join(COMMANDS_DIR, subdir);

    const files = readDirectoryRecursive(subdirectoryPath)
      .map((filePath) => {
        try {
          return require(filePath);
        } catch (err) {
          console.error(`Erro ao importar ${filePath}:`, err);
          return null;
        }
      })
      .filter(Boolean);

    commandImports[subdir] = files;
  }

  return commandImports;
};

const onlyNumbers = (text) => text.replace(/[^0-9]/g, "");

exports.onlyNumbers = onlyNumbers;

exports.toUserJid = (number) => `${onlyNumbers(number)}@s.whatsapp.net`;

exports.getBuffer = (url, options) => {
  return new Promise((resolve, reject) => {
    axios({
      method: "get",
      url,
      headers: {
        DNT: 1,
        "Upgrade-Insecure-Request": 1,
        range: "bytes=0-",
      },
      ...options,
      responseType: "arraybuffer",
      proxy: options?.proxy || false,
    })
      .then((res) => {
        resolve(res.data);
      })
      .catch(reject);
  });
};

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.getRandomNumber = getRandomNumber;

exports.getRandomName = (extension) => {
  const fileName = getRandomNumber(0, 999999);

  if (!extension) {
    return fileName.toString();
  }

  return `${fileName}.${extension}`;
};

exports.getImageBuffer = async (url, options = {}) => {
  try {
    const defaultOptions = {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
    };

    const fetchOptions = { ...defaultOptions, ...options };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(
        `Falha ao obter imagem: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();

    return buffer;
  } catch (error) {
    errorLog(`Erro ao obter o buffer da imagem: ${error.message}`);
    throw error;
  }
};

exports.randomDelay = async () => {
  const values = [1000, 2000, 3000];
  return await delay(values[getRandomNumber(0, values.length - 1)]);
};

exports.isAtLeastMinutesInPast = (timestamp, minimumMinutes = 5) => {
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const diffInSeconds = currentTimestamp - timestamp;

  const diffInMinutes = Math.floor(diffInSeconds / 60);

  return diffInMinutes >= minimumMinutes;
};

exports.getLastTimestampCreds = () => {
  const credsJson = JSON.parse(
    fs.readFileSync(
      path.resolve(ASSETS_DIR, "auth", "baileys", "creds.json"),
      "utf-8"
    )
  );

  return credsJson.lastAccountSyncTimestamp;
};

exports.GROUP_PARTICIPANT_ADD = 27;
exports.GROUP_PARTICIPANT_LEAVE = 32;
exports.isAddOrLeave = [27, 32];
