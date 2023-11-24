const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function checkAuth(req, res, next) {
  let token = (req.get("Bearer") || "").replace(" ", "");
  if (!token) {
    throw new Error("Token Missing");
  }

  try {
    let { _id, exp } = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(_id);
    if (!user) {
      throw new Error("User is not found");
    }

    if (Date.now() > exp) {
      user.tokens = (user.tokens || [])?.filter((t) => {
        t.token !== token;
      });
      user.save();
      throw new Error("Token expired");
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(500).send(err);
  }
}

module.exports = checkAuth;
