const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const { PassThrough } = require("stream");
const asyncHandler = require("express-async-handler");
require("dotenv").config();

const botToken = process.env.API_TOKEN;
const channelId = process.env.CHAT_ID;

console.log(`token ${botToken}, ID ${channelId}`);

exports.uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  const filePath = path.join(__dirname, "..", "uploads", file.filename);

  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("document", fs.createReadStream(filePath));

  const options = {
    method: "POST",
    headers: {
      ...formData.getHeaders(),
    },
    body: formData,
  };

  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;

  const request = https.request(url, options, (response) => {
    let data = "";
    response.on("data", (chunk) => {
      data += chunk;
    });
    response.on("end", () => {
      fs.unlinkSync(filePath); // Delete the file after upload
      res.status(200).json({
        message: "File uploaded successfully",
        data: JSON.parse(data),
      });
    });
  });

  request.on("error", (error) => {
    res
      .status(500)
      .json({ message: "Failed to upload file", error: error.message });
  });

  formData.pipe(request);
});

//Downloading is currently broken sometimes working sometimes don't'

exports.downloadFile = asyncHandler(async (req, res) => {
  const fileId = req.query.fileId; // Get the file ID from the request parameters
  console.log("Received fileId:", fileId);

  // URL to get file info
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  console.log("Requesting file info from:", fileInfoUrl);

  // Request to get file info
  const fileInfo = await new Promise((resolve, reject) => {
    const req = https.get(fileInfoUrl, { timeout: 10000 }, (response) => {
      // Set timeout to 10 seconds
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          console.log("File info response:", parsedData);
          if (parsedData.ok) {
            resolve(parsedData.result);
          } else {
            reject(new Error(`Telegram API error: ${parsedData.description}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });

  const filePath = fileInfo.file_path;
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  console.log("File URL:", url);

  // Request to download the file
  const fileStream = await new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 100000 }, (response) => {
      // Set timeout to 10 seconds
      if (response.statusCode === 200) {
        resolve(response);
      } else {
        reject(
          new Error(
            `Failed to download file. Status Code: ${response.statusCode}`,
          ),
        );
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });

  const downloadPath = path.join(
    __dirname,
    "..",
    "downloads",
    path.basename(filePath),
  );
  console.log("Downloading to:", downloadPath);

  // Create a write stream to save the file
  const fileWriteStream = fs.createWriteStream(downloadPath);
  fileStream.pipe(fileWriteStream);

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
});

exports.renderForm = (req, res) => {
  res.render("index");
};
