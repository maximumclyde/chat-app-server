const request = require("supertest");
const app = require("../app");
const {
  userOneId,
  userTwoId,
  setupDb,
  userOne,
  userTwo,
} = require("./fixtures/db");

beforeAll(setupDb);

test("Should login user", async () => {
  await request(app)
    .post("/users/login")
    .send({
      email: "email@email.com",
      password: "Password123!",
    })
    .expect(200);
});

test("Should change user data", async () => {
  await request(app)
    .patch("/users/profile")
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .send({ userName: "Updated Name" })
    .expect(200);
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

test("User 2 should not be able to accept any more requests", async () => {
  await request(app)
    .post(`/users/accept/${userOneId}`)
    .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
    .send()
    .expect(500);
});

test("User 2 should not be able to decline a request", async () => {
  await request(app)
    .post(`/users/decline/${userOneId}`)
    .set("Authorization", `Bearer ${userTwo.tokens[0].token}`)
    .expect(500);
});

test("User 1 should unfriend user 2", async () => {
  await request(app)
    .post(`/users/unfriend/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200);
});

test("User 1 should block user 2", async () => {
  await request(app)
    .post(`/users/block/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200);
});

test("User 1 should unblock user 2", async () => {
  await request(app)
    .post(`/users/unblock/${userTwoId}`)
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200);
});

test("Should logout user", async () => {
  await request(app)
    .post("/users/logout")
    .set("Authorization", `Bearer ${userOne.tokens[1].token}`)
    .expect(200);
});

test("User 1 should be able to delete their profile", async () => {
  await request(app)
    .delete("/users/profile")
    .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
    .expect(200);
});
