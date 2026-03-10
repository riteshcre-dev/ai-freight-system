// workers/queues.js
// ============================================================
// JOB QUEUES — Bull/Redis
// ============================================================

const Bull = require('bull');
const logger = require('../utils/logger');

let searchQueue, emailQueue, followUpQueue, replyQueue, agentQueue;

function initQueues() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const opts = { redis: redisUrl };

  searchQueue   = new Bull('search',   opts);
  emailQueue    = new Bull('email',    opts);
  followUpQueue = new Bull('followup', opts);
  replyQueue    = new Bull('reply',    opts);
  agentQueue    = new Bull('agent',    opts);

  // ── Process: Search + Contact Discovery ──────────────────
  searchQueue.process('run_search', 3, async (job) => {
    const { discoverShippers } = require('./processors/searchProcessor');
    return discoverShippers(job.data);
  });

  // ── Process: Send Email ───────────────────────────────────
  emailQueue.process('send_email', 5, async (job) => {
    const { processEmailJob } = require('./processors/emailProcessor');
    return processEmailJob(job.data);
  });

  // ── Process: Follow-ups ───────────────────────────────────
  followUpQueue.process('followup', 3, async (job) => {
    const { processFollowUp } = require('./processors/followupProcessor');
    return processFollowUp(job.data);
  });

  // ── Process: Reply Analysis ───────────────────────────────
  replyQueue.process('analyze_reply', 3, async (job) => {
    const { analyzeReply } = require('../modules/replyAnalysis');
    return analyzeReply(job.data.replyId);
  });

  // ── Process: Load Securing Agent ─────────────────────────
  agentQueue.process('agent_message', 3, async (job) => {
    const { processAgentMessage } = require('../modules/loadSecuringAgent');
    return processAgentMessage(job.data.opportunityId, job.data.message);
  });

  // ── Error Handlers ────────────────────────────────────────
  [searchQueue, emailQueue, followUpQueue, replyQueue, agentQueue].forEach(q => {
    q.on('error', err => logger.error(`[Queue:${q.name}] Error:`, err));
    q.on('failed', (job, err) => logger.error(`[Queue:${q.name}] Job ${job.id} failed:`, err.message));
    q.on('completed', (job) => logger.info(`[Queue:${q.name}] Job ${job.id} completed`));
  });

  return { searchQueue, emailQueue, followUpQueue, replyQueue, agentQueue };
}

const getSearchQueue   = () => searchQueue;
const getEmailQueue    = () => emailQueue;
const getFollowUpQueue = () => followUpQueue;
const getReplyQueue    = () => replyQueue;
const getAgentQueue    = () => agentQueue;

module.exports = { initQueues, getSearchQueue, getEmailQueue, getFollowUpQueue, getReplyQueue, getAgentQueue };
