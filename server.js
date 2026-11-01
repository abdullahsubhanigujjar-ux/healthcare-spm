const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from routes/public
app.use(express.static(path.join(__dirname, 'routes', 'public')));

// Mount API routes (All 6 SPM Modules)
app.use('/api/charter', require('./routes/charter'));
app.use('/api/scope', require('./routes/scope'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/cost', require('./routes/cost'));
app.use('/api/quality', require('./routes/quality'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Root route fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'routes', 'public', 'index.html'));
});

// Global Exception & Error Handler
app.use((err, req, res, next) => {
  console.error('[SPM Server Error]:', err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Auto-seed if database is empty on first boot
try {
  const charterCount = db.prepare('SELECT count(*) as cnt FROM project_charter').get();
  if (!charterCount || charterCount.cnt === 0) {
    console.log('[System Init]: Database empty. Running initial seeder...');
    require('./seed');
  }
} catch (e) {
  console.error('[System Init]: Error during check:', e.message);
}

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`Smart Healthcare Project Management & Monitoring System (CSE-494)`);
  console.log(`Server actively running on: http://localhost:${PORT}`);
  console.log(`Database connected via better-sqlite3`);
  console.log(`==================================================================`);
});

module.exports = app;
