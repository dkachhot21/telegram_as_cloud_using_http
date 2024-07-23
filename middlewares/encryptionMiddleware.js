const { log } = require("console");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const algorithm = "aes-256-ctr";
const secretKey = Buffer.from(process.env.SECRET_KEY, "hex"); // Store your secret key in environment variables

log(secretKey);
const encrypt = (buffer) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return encrypted;
};

const decrypt = (buffer) => {
  const iv = buffer.slice(0, 16);
  const encryptedText = buffer.slice(16);
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);
  return decrypted;
};

const encryptFileMiddleware = (req, res, next) => {
  const filePath = path.join(__dirname, "..", "uploads", req.file.filename);
  const fileBuffer = fs.readFileSync(filePath);
  const encryptedBuffer = encrypt(fileBuffer);
  const encryptedFilePath = `${filePath}.enc`;
  fs.writeFileSync(encryptedFilePath, encryptedBuffer);
  req.encryptedFilePath = encryptedFilePath;
  req.originalFilePath = filePath;
  next();
};

const decryptFileMiddleware = (req, res, next) => {
  const encryptedFilePath = req.encryptedFilePath;
  const encryptedBuffer = fs.readFileSync(encryptedFilePath);
  const decryptedBuffer = decrypt(encryptedBuffer);
  const decryptedFilePath = encryptedFilePath.replace(".enc", "");
  fs.writeFileSync(decryptedFilePath, decryptedBuffer);
  req.decryptedFilePath = decryptedFilePath;
  fs.unlinkSync(encryptedFilePath); // Delete the encrypted file after decryption
  next();
};

module.exports = { encryptFileMiddleware, decryptFileMiddleware };
