require("dotenv").config();

const express = require("express");
const app = express();

const expressWs = require("express-ws")(app);

const bodyParser = require("body-parser");
const cors = require("cors");

const Routers = require("./routers");
const WsRouters = require("./socket");

app.use(bodyParser);
app.use(cors);

for (const router of Routers) {
  app.use(Routers[router]);
}

for (const router of WsRouters) {
  app.use(WsRouters[router]);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT: ", PORT);
});
