const express = require("express");
const router = express.Router();
const {
  uploadFile,
  downloadFile,
  renderForm,
} = require("../controllers/telegramController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const {
  encryptFileMiddleware,
} = require("../middlewares/encryptionMiddleware");

// Routes
router.get("/", renderForm);
router.post(
  "/upload",
  upload.single("file"),
  encryptFileMiddleware,
  uploadFile,
);
router.get("/download", downloadFile);

module.exports = router;
