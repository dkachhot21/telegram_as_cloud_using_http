// controllers/telegramController.js
const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const https = require("https");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const asyncHandler = require("express-async-handler");
const {
  decryptFileMiddleware,
} = require("../middlewares/encryptionMiddleware");

const botToken = process.env.API_TOKEN;
const channelId = process.env.CHAT_ID;

// Configure axios to retry requests on failure
axiosRetry(axios, {
  retries: 3, // Number of retries
  retryDelay: axiosRetry.exponentialDelay, // Use exponential backoff
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response.status >= 500
    );
  },
});

const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  const encryptedFilePath = req.encryptedFilePath;
  const originalFilePath = req.originalFilePath;

  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("document", fs.createReadStream(encryptedFilePath));
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const maxRetries = 3;
  let attempts = 0;

  const upload = () => {
    attempts += 1;
    const formData = new FormData();
    formData.append("chat_id", channelId);
    formData.append("document", fs.createReadStream(encryptedFilePath));

    const options = {
      method: "POST",
      headers: {
        ...formData.getHeaders(),
      },
    };

    const request = https.request(url, options, (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        // Delete the files after upload
        fs.unlinkSync(originalFilePath);
        fs.unlinkSync(encryptedFilePath);

        data = JSON.parse(data);
        if (data.ok) {
          const file_id = data.result.document.file_id;
          res.status(200).json({
            message: "File uploaded successfully",
            file_name: file.originalname,
            file_id: file_id,
          });
        } else {
          if (attempts < maxRetries) {
            upload(); // Retry upload
          } else {
            res.status(500).json({
              message: "Failed to upload file after multiple attempts",
            });
          }
        }
      });
    });

    request.on("error", (error) => {
      if (attempts < maxRetries) {
        upload(); // Retry upload
      } else {
        res
          .status(500)
          .json({ message: "Failed to upload file", error: error.message });
      }
    });

    formData.pipe(request);
  };

  upload();
});

const downloadEncryptedFile = asyncHandler(async (req, res, next) => {
  const fileId = req.query.fileId; // Get the file ID from the request parameters
  console.log("Received fileId:", fileId);

  // URL to get file info
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  console.log("Requesting file info from:", fileInfoUrl);

  try {
    // Request to get file info
    const fileInfoResponse = await axios.get(fileInfoUrl, { timeout: 10000 });
    const fileInfo = fileInfoResponse.data;

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${fileInfo.description}`);
    }

    const filePath = fileInfo.result.file_path;
    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    console.log("File URL:", url);

    const encryptedDownloadPath = path.join(
      __dirname,
      "..",
      path.basename(filePath),
    );

    console.log("Downloading to:", encryptedDownloadPath);

    // Request to download the file
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 100000,
    });

    // Create a write stream to save the encrypted file
    const fileWriteStream = fs.createWriteStream(encryptedDownloadPath);

    response.data.pipe(fileWriteStream);

    fileWriteStream.on("finish", () => {
      req.encryptedFilePath = encryptedDownloadPath;
      next();
    });

    fileWriteStream.on("error", (err) => {
      res
        .status(500)
        .json({ message: "Failed to save file", error: err.message });
    });
  } catch (err) {
    console.error("Error downloading file:", err);
    res
      .status(500)
      .json({ message: "Failed to download file", error: err.message });
  }
});

// Ensure that downloadFile also handles decryption
const downloadFile = [
  downloadEncryptedFile,
  decryptFileMiddleware,
  (req, res) => {
    const decryptedFilePath = req.decryptedFilePath;

    // Send the decrypted file to the client
    res.download(decryptedFilePath, (err) => {
      if (err) {
        res
          .status(500)
          .json({ message: "Failed to download file", error: err.message });
      } else {
        fs.unlinkSync(decryptedFilePath); // Delete the file after download
      }
    });
  },
];

const renderForm = (req, res) => {
  res.render("index");
};

module.exports = {
  uploadFile,
  downloadFile,
  renderForm,
};
