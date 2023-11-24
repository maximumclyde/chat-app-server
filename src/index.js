require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const { createSocketInstance, ChatRouter } = require("./socket");

const app = express();
createSocketInstance(app);

const bodyParser = require("body-parser");
const cors = require("cors");

const Routers = require("./routers");

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.use(ChatRouter);

mongoose.connect(process.env.DB_URL, {
  dbName: "chat-app",
});

for (const router of Routers) {
  app.use(Routers[router]);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT: ", PORT);
});
