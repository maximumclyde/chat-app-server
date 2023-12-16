const request = require("supertest");
const app = require("../app");
const { userOne, setupDb } = require("./fixtures/db");

describe("Preference test suite", () => {
  const OLD_ENV = process.env;
  process.env.NODE_ENV = "test";

  beforeAll(setupDb);

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  test("Should update user preference", async () => {
    await request(app)
      .patch("/userPreferences")
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .set("Content-Type", "application/json")
      .send({
        test: "test",
      })
      .expect(200);
  });

  test("Should delete the test key from the preference", async () => {
    await request(app)
      .patch("/userPreferences/removePreference")
      .set("Authorization", `Bearer ${userOne.tokens[0].token}`)
      .set("Content-Type", "application/json")
      .send(["test"])
      .expect(200);
  });
});
