require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express();
const expressWs = require("express-ws")(app);

const { createSocketInstance, ChatRouter } = require("./socket");
createSocketInstance(expressWs);

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

for (const router in Routers) {
  app.use(Routers[router]);
}

module.exports = app;
