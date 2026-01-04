// Adapter to expose `registerTracker(app, options)` as requested by bootstrap code
// Support either export name from routes/tracker (registerTracker or registerTrackerRoutes)
const trackerImpl = require('./tracker');
function registerTracker(app, options = {}) {
  if (trackerImpl && typeof trackerImpl.registerTracker === 'function') {
    return trackerImpl.registerTracker(app, options);
  }
  if (trackerImpl && typeof trackerImpl.registerTrackerRoutes === 'function') {
    return trackerImpl.registerTrackerRoutes(app, options);
  }
  throw new Error('tracker implementation does not export registerTracker/registerTrackerRoutes');
}
module.exports = { registerTracker };
