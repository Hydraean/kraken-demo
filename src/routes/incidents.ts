const incidentsRoute = require("express").Router();
import Fuse from "fuse.js";
import lowdb from "../lowdbInterface";
import { formatIncidents } from "../helpers";

incidentsRoute.get("/", (req, res) => {
  let allEvents = lowdb.get("incidents").value();

  let responseData = formatIncidents(allEvents);

  res.send(responseData);
});

incidentsRoute.get("/search", (req, res) => {
  let query: any = req.query.query;

  let incidentList = lowdb.get("incidents").value();

  const options = {
    keys: [
      "device_id",
      "name",
      "title",
      "reportee",
      "report_type",
      "date",
      "details",
      "source_platform",
      "type",
      "status",
      "fma",
    ],
  };

  if (query) {
    const fuse = new Fuse(incidentList, options);
    let results: any = fuse.search(query);

    let searchResults = results.map((x) => x.item);

    results = formatIncidents(searchResults);

    res.send(results);
  } else {
    res.status(400).send({
      message: "Search failed. No query provided.",
      status: 400,
    });
  }
});

// for testing scount devices integration

incidentsRoute.get("/scout/test/", (req, res) => {
  let outputCount = req.query.count ? req.query.count : 100;
  let allEvents = lowdb
    .get("incidents")
    .value()
    .filter((x) => x.status === "PENDING");

  let scoutDataFormat = allEvents.map((report) => {
    return {
      id: report.id,
      dt: `${report.name} : ${report.details}`,
      di: report.device_id,
      tp: report.type === "emergency" ? "cr" : "if",
      rp: report.name === "" ? "Anonymous" : report.name,
      sp: "node",
      dn: report.date_reported,
      md: "1",
      cr: {
        lt: report.coordinates.lat,
        lg: report.coordinates.long,
      },
    };
  });

  res.send(scoutDataFormat.slice(0, 20));
});

module.exports = incidentsRoute;
