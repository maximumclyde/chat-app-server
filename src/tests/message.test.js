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

beforeAll(setupDb);

test("User 1 should not be able to send a message to user 2", async () => {
  await request(app)
    .post(`/message/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .set("Content-Type", "application/json")
    .set("Accept", "application/json")
    .send({ content: "Some message" })
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

test("User 1 should be able to send a message", async () => {
  await request(app)
    .post(`/message/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .set("Content-Type", "application/json")
    .set("Accept", "application/json")
    .send({ content: "Some message" })
    .expect(200);
});

test("There should be a fetched message between the users", async () => {
  await request(app)
    .get(`/message/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200)
    .expect((res) => {
      expect(res.body.length).toBe(1);
    });
});

test("User 1 should add user 2 as a group member", async () => {
  await request(app)
    .post(`/groups/${groupId}/addUser/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200);
});

test("User 2 should send a message to the group", async () => {
  await request(app)
    .post(`/message/group/${groupId}`)
    .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
    .set("Content-Type", "application/json")
    .set("Accept", "application/json")
    .send({ content: "Test group message" })
    .expect(200);
});

test("User 1 should get the new message from the group", async () => {
  await request(app)
    .get(`/message/group/${groupId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200)
    .expect((res) => {
      expect(res.body.length).toBe(1);
    });
});
