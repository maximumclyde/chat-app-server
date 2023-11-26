const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function checkAuth(req, res, next) {
  try {
    const token = req.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new Error({
        message: "Token is missing!",
      });
    }

    let { _id, exp } = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findOne({ _id, "tokens.token": token });

    if (!user) {
      throw new Error({
        message: "User was not found",
      });
    }

    if (Date.now() / 1000 > Number(exp)) {
      user.tokens = user.tokens.filter(({ token: t }) => t !== token);
      await user.save();
      throw new Error({
        message: "Token has expired!",
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(401).send(err);
  }
}

module.exports = checkAuth;
