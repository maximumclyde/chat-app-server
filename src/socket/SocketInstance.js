const expressWsInitiator = require("express-ws");
const expressWs = null;

function createSocketInstance(app) {
  expressWs = expressWsInitiator(app);
}

function getSocketInstance() {
  return expressWs;
}

function findWsUser(id) {
  if (expressWs) {
    let clientIterator = expressWs.getWss().clients.entries();
    for (const [client] of clientIterator) {
      if (client?.["userId"] === id) {
        return client;
      }
    }
  }
  return undefined;
}

module.exports = {
  createSocketInstance,
  getSocketInstance,
  findWsUser,
};
