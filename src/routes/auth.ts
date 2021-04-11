import axios from "axios";
const AuthRoute = require("express").Router();
const API_URL = process.env.TDB_URL;

AuthRoute.post("/checkAccess", (req, res) => {
  let email = req.body.email;

  axios({
    method: "get",
    url: `${API_URL}/fetch_data`,
    params: {
      db_name: "admins",
    },
    headers: {
      Authorization: `Bearer ${process.env.TDB_ACCESS_TOKEN}`,
    },
  })
    .then((response) => {
      let user_list = response.data;

      let userCheck = user_list.find((x) => x.email === email);

      if (userCheck && userCheck.access === "TRUE") {
        res.send({
          message: "Access Granted",
        });
      } else {
        res.send({
          message: "No access",
        });
      }
    })
    .catch((err) => {
      res.send(err);
    });
});

module.exports = AuthRoute;
