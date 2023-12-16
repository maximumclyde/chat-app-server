const mongoose = require("mongoose");

const preferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    required: true,
    unique: true,
  },
  preferences: mongoose.Schema.Types.Mixed,
});

const PreferencesModel = mongoose.model("Preferences", preferencesSchema);

module.exports = PreferencesModel;
