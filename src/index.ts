import express from "express";
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const path = require("path");
import cors from "cors";
import bodyParser from "body-parser";
import { formatIncidents, guid, isFloat } from "./helpers";
import moment from "moment-timezone";
import lowdb from "./lowdbInterface";

const version = "0.1.0";

require("dotenv").config();

io.set("origins", "*:*");

let port = process.env.PORT || 7000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname + "/public/fma_images")));
http.listen(port);

console.log(`===============================`);
console.log(`Kraken Demo API: ${port}`);
console.log(`===============================`);

// import routers
const AnalyticsRouter = require("./routes/analytics");
const IncidentsRouter = require("./routes/incidents");
const DevicesRouter = require("./routes/devices");
const DatasetRouter = require("./routes/datasets");
const DBRouter = require("./routes/db");
const AuthRouter = require("./routes/auth");

// assign endpoints
app.use("/analytics", AnalyticsRouter);
app.use("/incidents", IncidentsRouter);
app.use("/devices", DevicesRouter);
app.use("/dataset", DatasetRouter);
app.use("/auth", AuthRouter);
app.use("/db", DBRouter);

// get status
app.get("/", (req, res) => {
  res.send({
    message: `Kraken Demo API v.${version}`,
    setup: process.env.MDB_USER
      ? "Running"
      : "[Failed] Incomplete ENV Variables.",
  });
});

// recieve raw reports
app.post("/report", (req, res) => {
  let reqData = req.body.data;
  let resData = {};

  console.log(reqData);

  if (reqData) {
    try {
      // parse payload
      let rData = JSON.parse(reqData);
      let reportInstanceCheck = lowdb
        .get("incidents")
        .find({ id: rData.id })
        .value();

      // ::NOTE for testing report endpoint refactor the fma_classification variable is fixed to FMA-06
      // let fma_classification = getFMA([rData.cr.lg, rData.cr.lt]);
      let fma_classification = "FMA-06";

      // check if fma classification is valid.
      if (fma_classification) {
        // new report data mapped
        resData = {
          id: rData.id,
          details: rData.dt,
          device_id: rData.di,
          type: rData.tp === "cr" ? "emergency" : "illegal_fishing",
          name:
            rData.tp === "if" ? "Illegal Fishing Report" : "Emergency Report",
          title:
            rData.tp === "if" ? "Illegal Fishing Report" : "Emergency Report",
          fma: fma_classification,
          reportee: rData.rp,
          source_platform: rData.sp,
          date_reported: rData.dn,
          date_created: Date.now(),
          date_updated: Date.now(),
          date_confirmed: null,
          coordinates: {
            long: rData.cr.lg,
            lat: rData.cr.lt,
          },
          report_type: rData.md === "0" ? "manual" : "auto",
          status: "PENDING",
          updates: [],
        };

        // check if the report instance exists
        if (!reportInstanceCheck) {
          lowdb.get("incidents").value().push(resData);
          let updatedRecords = formatIncidents(lowdb.get("incidents").value());
          io.emit("feedUpdate", { data: updatedRecords });
          lowdb.write();
        } else {
          // update existing report
          console.log("updating report");
          let existingReport = lowdb
            .get("incidents")
            .find({ id: rData.id })
            .value();

          let reportUpdate = {
            coordinates: { lat: rData.cr.lt, long: rData.cr.lg },
            date: rData.dn,
          };

          existingReport.date_updated = Date.now();

          // define updates array if it doesn't exist
          if (!existingReport.updates) {
            existingReport.updates = [];
          }

          let checkUpdateEntry = existingReport.updates.find(
            ({ coordinates }) =>
              coordinates.lat === reportUpdate.coordinates.lat &&
              coordinates.long === reportUpdate.coordinates.long
          );

          // write report update of coordinates to db if it doesn't exist.
          if (!checkUpdateEntry) {
            existingReport.updates.push(reportUpdate);
            lowdb.write();
          }
        }
        // TODO: add device cataloging
        // send valid response
        res.status(200).send({ message: "Report saved successfully." });

        // broadcast updated report records
        let updatedRecords = formatIncidents(lowdb.get("incidents").value());
        io.emit("feedUpdate", { data: updatedRecords });
      } else {
        res
          .status(400)
          .send({ message: "Invalid Coordinates, no FMA classification!" });
      }
    } catch (err) {
      console.log(err);
      res.status(400).send("Error: Invalid data format");
    }
  } else {
    res.status(400).send("Missing data parameter.");
  }
});

// confirm / verify report

app.post("/report/confirm", (req, res) => {
  let reportID = req.body.id;

  if (reportID) {
    let reportInstance = lowdb.get("incidents").find({ id: reportID }).value();
    if (reportInstance) {
      reportInstance.status = "CONFIRMED";
      reportInstance.verifier = "Hydraean_Admin";
      lowdb.write();

      let updatedRecords = formatIncidents(lowdb.get("incidents").value());
      io.emit("feedUpdate", { data: updatedRecords });

      res.status(200).send({
        message: "Successfully confirmed report",
      });
    } else {
      res.status(400).send({
        message: "Process failed. Unable to find report with the ID provided",
        status: 400,
      });
    }
  } else {
    res.status(400).send({ status: 400, message: "Incomplete data provided" });
  }
});

// recieve report from web demo

app.post("/add/report", (req, res) => {
  let payload = req.body;

  if (payload.device_id && payload.device_id.trim() !== "") {
    if (
      payload.coordinates &&
      isFloat(payload.coordinates.lat) &&
      isFloat(payload.coordinates.long)
    ) {
      let newReport = {
        id: payload.id,
        details: payload.details ? payload.details : "N/A",
        device_id: payload.device_id,
        type: payload.type ? payload.type : "emergency",
        name: payload.type ? payload.type : "emergency",
        title: payload.title ? payload.title : "WEB: Report Event",
        address: payload.address ? payload.address : "N/A",
        reportee: payload.reportee ? payload.reportee : "Anonymous",
        source_platform: "Web",
        date: Date.now(),
        date_created: Date.now(),
        date_updated: Date.now(),
        date_confirmed: null,
        coordinates: {
          long: payload.coordinates.long,
          lat: payload.coordinates.lat,
        },
        report_type: "AUTO",
        status: "PENDING",
        updates: [],
      };

      let existingReport = lowdb
        .get("incidents")
        .find({ id: newReport.id })
        .value();

      if (!existingReport) {
        // save report to event collection
        lowdb.get("incidents").value().push(newReport);
      } else {
        console.log("[Web] updating report");

        existingReport.date_updated = Date.now();

        let reportUpdate = {
          coordinates: {
            lat: payload.coordinates.lat,
            long: payload.coordinates.long,
          },
          date: Date.now(),
        };

        if (!existingReport.updates) {
          existingReport.updates = [];
        }

        let checkUpdateEntry = existingReport.updates.find(
          ({ coordinates }) =>
            coordinates.lat === reportUpdate.coordinates.lat &&
            coordinates.long === reportUpdate.coordinates.long
        );

        // write report update of coordinates to db if it doesn't exist.
        if (!checkUpdateEntry) {
          existingReport.updates.push(reportUpdate);
          lowdb.write();
        }
      }

      // record interaction with device.
      let deviceID = payload.device_id;

      let deviceInstance = lowdb
        .get("devices")
        .find({ device_id: deviceID })
        .value();

      if (!deviceInstance) {
        let newDevice = {
          id: guid(),
          device_id: deviceID,
          type: deviceID.includes("HN-") ? "node" : "gateway",
          first_interaction: moment()
            .tz("Asia/Taipei")
            .format("MMMM D YYYY,hh:mm:ss A"),
          last_interaction: moment()
            .tz("Asia/Taipei")
            .format("MMMM D YYYY,hh:mm:ss A"),
        };
        lowdb.get("devices").value().push(newDevice);
      } else {
        deviceInstance.last_interaction = moment()
          .tz("Asia/Taipei")
          .format("MMMM D YYYY,hh:mm:ss A");
      }

      lowdb.write();

      let updatedRecords = formatIncidents(lowdb.get("incidents").value());

      // broadcast updated report records
      io.emit("feedUpdate", { data: updatedRecords });

      console.log(`KRAKEN API: Report recieved from device: ${deviceID}`);

      res.status(200).send({
        message: "Report Saved!",
        status: "ok",
      });
    } else {
      res.status(400).send({ message: "Provide proper GPS Coordinates" });
    }
  } else {
    res.status(400).send({ message: "Imcomplete data provided." });
  }
});

// recieve and display payload data

app.post("/orion/test", (req, res) => {
  console.log(req.body.data);
  res.send("data recieved");
});

app.get("/device/report/test", (req, res) => {
  res.send("OK");
  let payload: any = req.query.text;
  console.log(JSON.parse(payload));
});

// Handle Socket Events
io.sockets.on("connection", function (socket: any) {
  // for initilisation of a node
});
