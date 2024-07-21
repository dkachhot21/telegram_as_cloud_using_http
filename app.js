const express = require("express");
const telegramRoutes = require("./routes/telegramRoutes");
const dotenv = require("dotenv").config();
const app = express();

app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use("/", telegramRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
