const logger = require('../utils/logger');
let queues = {};
async function initQueues() {
  try {
    logger.info('Initializing job queues...');
    queues = {
      emailQueue: { name: 'email', jobs: [] },
      searchQueue: { name: 'search', jobs: [] },
      notificationQueue: { name: 'notification', jobs: [] },
    };
    logger.info('Job queues ready');
    return queues;
  } catch (err) {
    logger.error('Failed to initialize queues:', err);
    throw err;
  }
}
function getQueue(name) { return queues[name] || null; }
module.exports = { initQueues, getQueue };
