const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User, Group, Message } = require("../../models");

const userOneId = new mongoose.Types.ObjectId();
const userOne = {
  _id: userOneId,
  userName: "Clyde 1",
  userEmail: "email@email.com",
  userPassword: "Password123!",
  tokens: [
    {
      token: jwt.sign({ _id: userOneId }, process.env.JWT_SECRET, {
        expiresIn: "40 days",
      }),
    },
    {
      token: jwt.sign({ _id: userOneId }, process.env.JWT_SECRET, {
        expiresIn: "40 days",
      }),
    },
  ],
};

const userTwoId = new mongoose.Types.ObjectId();
const userTwo = {
  _id: userTwoId,
  userName: "Clyde 2",
  userEmail: "email2@email.com",
  userPassword: "Password123!",
  tokens: [
    {
      token: jwt.sign({ _id: userTwoId }, process.env.JWT_SECRET, {
        expiresIn: "40 days",
      }),
    },
  ],
};

async function setupDb() {
  await Promise.all([
    User.deleteMany(),
    Message.deleteMany(),
    Group.deleteMany(),
  ]);

  return await Promise.all([
    await new User(userOne).save(),
    await new User(userTwo).save(),
  ]);
}

module.exports = {
  userOneId,
  userTwoId,
  userOne,
  userTwo,
  setupDb,
};
