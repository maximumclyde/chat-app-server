const { Router } = require("express");
const { checkAuth } = require("../middleware");
const { User } = require("../models");

const router = Router();

router.post("/users", async (req, res) => {
  try {
    let user = await new User(req.body).save();
    let token = await user.generateToken();
    return res.status(200).send({
      user,
      token,
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get("/users/profile", checkAuth, (req, res) => {
  return res.status(200).send(req.user);
});

router.post("/users/:id", checkAuth, async (req, res) => {
  if (req.params.id !== req.user._id) {
    return res.status(502).send("Operation not allowed");
  }
  try {
    let user = { ...req.user, ...req.body };
    user = await user.save();
    return res.status(200).send(user);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.delete("/users/profile", checkAuth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.user._id });
    return res.status(200).send();
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/users/login");

module.exports = router;
