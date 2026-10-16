// pm2 keeps the WhatsApp Web process running on the always-on host and restarts it after a crash
// or a WhatsApp disconnect (the process exits non-zero on disconnect, by design).
// Start:   pm2 start apps/whatsapp-web/ecosystem.config.cjs
// Logs:    pm2 logs arch-flow-whatsapp-web
// Survive reboots: pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'arch-flow-whatsapp-web',
      script: 'src/WhatsAppWeb.js',
      cwd: __dirname,
      node_args: '--env-file-if-exists=.env',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 15000,
      min_uptime: '60s',
      env: { NODE_ENV: 'production' },
    },
  ],
};
