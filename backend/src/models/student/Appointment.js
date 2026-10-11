// The student booking flow and the welfare/management dashboards share the
// `appointments` collection. Re-export the canonical model so the `Appointment`
// model name is only registered once per process.
module.exports = require('../counselor/Appointment');
