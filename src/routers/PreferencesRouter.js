const { Router } = require("express");
const { checkAuth } = require("../middleware");
const { Preference } = require("../models");

const router = Router();

router.post("/userPreferences", checkAuth, async (req, res) => {
  const { user, body } = req;
  try {
    let userPreferences = await Preference.findOne({ userId: user._id });
    for (const key in body) {
      userPreferences["preferences"][key] = body[key];
    }
    userPreferences.markModified("preferences");
    await userPreferences.save();
    res.status(200).send(userPreferences);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post(
  "/userPreferences/removePreference",
  checkAuth,
  async (req, res) => {
    const { user, body } = req;
    try {
      let userPreferences = await Preference.findOne({ userId: user._id });
      for (const key of body) {
        delete userPreferences["preferences"][key];
      }
      userPreferences.markModified("preferences");
      await userPreferences.save();
      res.status(200).send(userPreferences);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

module.exports = router;
