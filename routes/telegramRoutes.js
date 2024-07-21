const express = require("express");
const router = express.Router();
const telegramController = require("../controllers/telegramController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Routes
router.get("/", telegramController.renderForm);
router.post("/upload", upload.single("file"), telegramController.uploadFile);
router.get("/download", telegramController.downloadFile);

module.exports = router;
