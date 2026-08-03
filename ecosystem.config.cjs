/**
 * PM2 ecosystem file for production deployment.
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # follow instructions to set up auto-start
 */
module.exports = {
  apps: [
    {
      name: "lomba-kampung",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,            // SQLite doesn't benefit from clustering
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      // Logs
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Auto-restart on crash
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
