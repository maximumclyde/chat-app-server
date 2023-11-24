const mongoose = require("mongoose");
const crypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { isEmail, isStrongPassword } = require("validator");

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    userEmail: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate(value) {
        return isEmail(value);
      },
    },
    userPassword: {
      type: String,
      required: true,
      trim: true,
      validate(value) {
        return isStrongPassword(value);
      },
    },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    skipVersioning: true,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const User = mongoose.Model("User", userSchema);

userSchema.methods.toJSON = function () {
  let user = this;
  const userObject = user.toObject();

  delete userObject.userPassword;
  delete userObject.tokens;

  return userObject;
};

userSchema.methods.generateToken = async function () {
  let user = this;
  const { _id } = user;
  if (!_id) {
    throw new Error("Could not generate token");
  }
  let token = jwt.sign({ _id }, process.env.JWT_SECRET, {
    expiresIn: "40 days",
  });
  user.tokens = [...user.tokens, { token }];
  try {
    await user.save();
  } catch (err) {
    throw new Error(err);
  }
  return token;
};

userSchema.pre("save", async function (next) {
  const user = this;
  if (user.isModified("userPassword")) {
    let pass = await crypt.hash(user.userPassword, 8);
    user.userPassword = pass;
  }
  next();
});

userSchema.static("findByCredentials", async (userEmail, userPassword) => {
  let user = await User.findOne({ userEmail });
  if (!user) {
    throw new Error("Unable to log in. Check your credentials.");
  }

  let comparison = await crypt.compare(userPassword, user.userPassword);
  if (!comparison) {
    throw new Error("Unable to log in. Check your credentials.");
  }

  return user;
});

module.exports = User;
