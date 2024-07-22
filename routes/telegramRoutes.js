const express = require("express");
const router = express.Router();
const {
  uploadFile,
  downloadFile,
  renderForm,
} = require("../controllers/telegramController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Routes
router.get("/", renderForm);
router.post("/upload", upload.single("file"), uploadFile);
router.get("/download", downloadFile);

module.exports = router;
