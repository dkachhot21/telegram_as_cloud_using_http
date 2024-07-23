const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const https = require("https");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const { PassThrough } = require("stream");
const asyncHandler = require("express-async-handler");
const { log } = require("console");
const dotenv = require("dotenv").config();

const botToken = process.env.API_TOKEN;
const channelId = process.env.CHAT_ID;

console.log(`token ${botToken}, ID ${channelId}`);

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
  const filePath = path.join(__dirname, "..", "uploads", file.filename);
  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("document", fs.createReadStream(filePath));
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const maxRetries = 3;
  let attempts = 0;

  const upload = () => {
    attempts += 1;
    const formData = new FormData();
    formData.append("chat_id", channelId);
    formData.append("document", fs.createReadStream(filePath));

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
        fs.unlinkSync(filePath); // Delete the file after upload
        data = JSON.parse(data);
        if (data.ok) {
          const file_id = data.result.document.file_id;
          res.status(200).json({
            message: "File uploaded successfully",
            file_id: file_id,
          });
        } else {
          if (attempts < maxRetries) {
            upload(); // Retry upload
          } else {
            res
              .status(500)
              .json({
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

//Downloading is currently broken sometimes working sometimes don't'

const downloadFile = asyncHandler(async (req, res) => {
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

    const downloadPath = path.join(__dirname, "..", path.basename(filePath));
    console.log("Downloading to:", downloadPath);

    // Request to download the file
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 100000,
    });

    // Create a write stream to save the file
    const fileWriteStream = fs.createWriteStream(downloadPath);

    response.data.pipe(fileWriteStream);

    fileWriteStream.on("finish", () => {
      res.download(downloadPath, (err) => {
        if (err) {
          res
            .status(500)
            .json({ message: "Failed to download file", error: err.message });
        } else {
          fs.unlinkSync(downloadPath); // Delete the file after download
        }
      });
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

const renderForm = (req, res) => {
  res.render("index");
};

module.exports = { uploadFile, downloadFile, renderForm };
