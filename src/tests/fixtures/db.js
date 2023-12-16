const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User, Group, Message, Preference } = require("../../models");

const userOneId = new mongoose.Types.ObjectId();
const groupId = new mongoose.Types.ObjectId();

const userOne = {
  _id: userOneId,
  userName: "Clyde 1",
  userEmail: "email@email.com",
  userPassword: "Password123!",
  groupList: [groupId],
  tokens: [
    {
      token: jwt.sign({ _id: userOneId }, process.env.JWT_SECRET, {
        expiresIn: "40 days",
      }),
    },
    {
      token: jwt.sign({ _id: userOneId }, process.env.JWT_SECRET, {
        expiresIn: "41 days",
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
  groupList: [],
  tokens: [
    {
      token: jwt.sign({ _id: userTwoId }, process.env.JWT_SECRET, {
        expiresIn: "40 days",
      }),
    },
  ],
};

const testGroup = {
  _id: groupId,
  groupName: "Test Group",
  groupMembers: [userOneId],
  groupAdmins: [userOneId],
  createdBy: {
    name: userOne.userName,
    id: userOneId,
  },
};

const preferenceOneId = new mongoose.Types.ObjectId();
const userOnePreferences = {
  _id: preferenceOneId,
  userId: userOneId,
  preferences: {
    theme: "dark",
  },
};

async function setupDb() {
  await Promise.all([
    User.deleteMany(),
    Message.deleteMany(),
    Group.deleteMany(),
    Preference.deleteMany(),
  ]);

  return await Promise.all([
    await new User(userOne).save(),
    await new User(userTwo).save(),
    await new Group(testGroup).save(),
    await new Preference(userOnePreferences).save(),
  ]);
}

module.exports = {
  userOneId,
  userTwoId,
  userOne,
  userTwo,
  setupDb,
  testGroup,
  groupId,
  userOnePreferences,
  preferenceOneId,
};
