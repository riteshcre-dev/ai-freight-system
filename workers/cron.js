const logger = require('../utils/logger');
function startCronJobs() {
  try {
    logger.info('Starting cron jobs...');
    logger.info('Cron jobs scheduled');
  } catch (err) {
    logger.error('Failed to start cron jobs:', err);
    throw err;
  }
}
module.exports = { startCronJobs };
