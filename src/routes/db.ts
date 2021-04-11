const dbRoute = require("express").Router();
const { MongoClient } = require("mongodb");
require("dotenv").config();

// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// var commentSchema = new Schema({});
// var mongoDB = `mongodb+srv://${process.env.MDB_USER}:${process.env.MDB_PASSWORD}@cluster0.cawmh.mongodb.net/sample_mflix`;
// mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
// var movies = mongoose.model("test", commentSchema);
// var db = mongoose.connection;
// db.on("error", console.error.bind(console, "MongoDB connection error:"));

// set up db
const uri = `mongodb+srv://${process.env.MDB_USER}:${process.env.MDB_PASSWORD}@cluster0.cawmh.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

dbRoute.get("/", async (req, res) => {
  try {
    await client.connect();
    const database = client.db("sample_mflix");
    const movies = database.collection("movies");
    // Query for a movie that has the title 'Back to the Future'
    const query = { title: "Back to the Future" };
    let d = await movies.findOne(query);

    res.send(d);
  } finally {
    await client.close();
  }

  // movies.find({}, function (error, data) {
  //   if (error) {
  //     res.send("error");
  //   }
  //   res.send(data);
  // });
});

module.exports = dbRoute;
