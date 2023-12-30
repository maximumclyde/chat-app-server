const app = require("./app");

const PORT = process.env.PORT || 3000;

console.clear();

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT: ", PORT);
});
