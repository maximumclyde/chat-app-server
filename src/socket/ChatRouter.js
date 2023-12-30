const express = require("express");

const ChatRouter = express.Router();

const activeUsers = {};

ChatRouter.ws("/chat", (ws, _, next) => {
  ws.on("message", (msg) => {
    try {
      const { request, body } = JSON.parse(msg);
      if (!request) {
        throw new Error("Invalid message");
      }

      if (request === "create-session") {
        const { userId } = body;
        if (!userId) {
          ws.terminate();
          throw new Error("Invalid session request");
        }

        ws["userId"] = userId;
        activeUsers[userId] = ws;
      } else {
        if (!ws?.["userId"] || !activeUsers?.[ws?.["userId"]]) {
          ws.terminate();
          throw new Error("Not authorized to make requests");
        }

        if (request === "ping") {
          ws.send(
            JSON.stringify({
              request: "pong",
              body: body,
            })
          );
        } else if (request === "notify-activity") {
          const { userList = [] } = body;
          for (const id of userList) {
            activeUsers?.[id]?.send(
              JSON.stringify({
                request: "active-user",
                body: ws?.["userId"],
              })
            );
          }
        }
      }
    } catch (err) {
      console.log("Error parsing message: ", err);
    }
  });

  ws.addEventListener("close", () => {
    try {
      for (const id of ws?.["friendList"] || []) {
        activeUsers?.[id]?.send(
          JSON.stringify({
            request: "inactive-user",
            body: ws?.["userId"],
          })
        );
      }
      delete activeUsers[ws?.["userId"]];
    } catch (err) {
      console.log("Error during connection closing: ", err);
    }
  });

  next();
});

module.exports = ChatRouter;
