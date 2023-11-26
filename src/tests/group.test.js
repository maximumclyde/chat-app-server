const request = require("supertest");
const app = require("../app");
const {
  userOneId,
  userTwoId,
  setupDb,
  userOne,
  userTwo,
  groupId,
} = require("./fixtures/db");

describe("Group test suite", () => {
  const OLD_ENV = process.env;
  process.env.NODE_ENV = "test";

  beforeAll(setupDb);

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  let newTestGroupId = undefined;
  test("User 2 should create a new group", async () => {
    await request(app)
      .post("/groups")
      .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send({ groupName: "Test group 2" })
      .expect(200)
      .expect((res) => {
        newTestGroupId = res.body._id;
      });
  });

  test("User 2 should not be able to add user 1 to the group", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/addUser/${userOneId}`)
      .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
      .expect(500);
  });

  test("User 1 should not be able to add user 2", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/addUser/${userTwoId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(500);
  });

  test("User 1 should send a request to user 2", async () => {
    await request(app)
      .post(`/users/request/${userTwoId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .send()
      .expect(200);
  });

  test("User 2 should accept friend request", async () => {
    await request(app)
      .post(`/users/accept/${userOneId}`)
      .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
      .send()
      .expect(200);
  });

  test("User 2 should add user 1 to the group", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/addUser/${userOneId}`)
      .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
      .expect(200);
  });

  test("User 1 should not be able to remove user 2", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/removeUser/${userTwoId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(500);
  });

  test("User 2 should make user 1 an admin", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/addAdmin/${userOneId}`)
      .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
      .expect(200);
  });

  test("User 1 should be able to remove user 2", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/removeUser/${userTwoId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(200);
  });

  test("User 1 should be able to leave the group", async () => {
    await request(app)
      .post(`/groups/${newTestGroupId}/removeUser/${userOneId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(200);
  });

  test("Group should have been automatically deleted", async () => {
    await request(app)
      .get(`/groups/${newTestGroupId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(500);
  });

  test("User 1 should send a message to the group", async () => {
    await request(app)
      .post(`/message/group/${groupId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send({ content: "Test group message" })
      .expect(200);
  });

  test("Default test group should be deleted", async () => {
    await request(app)
      .delete(`/groups/${groupId}`)
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .expect(200);
  });
});
