import BasePlugin from './base-plugin.js';
import axios from 'axios';

export default class ScheduledRestart extends BasePlugin {

  static get description() {
    return 'Scheduled restart after round end';
  }

  static get optionsSpecification() {
    return {
      restartTime: {
        required: true,
        description: 'Daily restart time in HH:MM format.',
        default: '04:00'
      },

      timezone: {
        required: false,
        description: 'IANA timezone.',
        default: 'America/Halifax'
      },

      maxWaitHours: {
        required: false,
        description: 'Maximum hours to wait for ROUND_ENDED.',
        default: 2
      },

      restartDelaySeconds: {
        required: false,
        description: 'Delay after ROUND_ENDED before restart.',
        default: 15
      },

      reminderIntervalMinutes: {
        required: false,
        description: 'How often to repeat restart reminder broadcasts.',
        default: 15
      },

      discordWebhook: {
        required: false,
        description: 'Discord webhook URL.',
        default: ''
      },

      pterodactyl: {
        required: true,
        description: 'Pterodactyl settings.',
        default: {}
      }
    };
  }

  static get optionSpecification() {
    return this.optionsSpecification;
  }

  async mount() {

    this.restartPending = false;
    this.windowExpires = 0;
    this.lastRestartDate = null;
    this.reminderInterval = null;

    this.server.on('ROUND_ENDED', async () => {
      await this.onRoundEnded();
    });

    this.scheduler = setInterval(
      () => this.checkSchedule(),
      30000
    );

    this.verbose(
      1,
      'ScheduledRestart mounted.'
    );
  }

  async unmount() {

    clearInterval(this.scheduler);

    this.stopReminders();
  }

  async checkSchedule() {

    const timezone =
      this.options.timezone || 'America/Halifax';

    const restartTime =
      this.options.restartTime;

    if (!restartTime) {

      this.verbose(
        1,
        'No restartTime configured.'
      );

      return;
    }

    const now = new Date();

    const currentTime = now.toLocaleTimeString(
      'en-CA',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      }
    );

    const currentDate = now.toLocaleDateString(
      'en-CA',
      {
        timeZone: timezone
      }
    );

    this.verbose(
      1,
      `Schedule check: current=${currentTime}, restart=${restartTime}, date=${currentDate}, last=${this.lastRestartDate}`
    );

    if (
      currentTime >= restartTime &&
      this.lastRestartDate !== currentDate &&
      !this.restartPending
    ) {

      this.restartPending = true;

      this.lastRestartDate =
        currentDate;

      this.windowExpires =
        Date.now() +
        ((this.options.maxWaitHours || 2) * 3600000);

      await this.broadcast(
        'Server restarting after this round!'
      );

      await this.sendDiscord(
        '🟠 Restart scheduled after current round.'
      );

      this.startReminders();

      this.verbose(
        1,
        'Restart window opened.'
      );
    }

    if (
      this.restartPending &&
      Date.now() > this.windowExpires
    ) {

      await this.forceRestart();
    }
  }

  async onRoundEnded() {

    if (!this.restartPending)
      return;

    this.restartPending = false;

    this.stopReminders();

    const delaySeconds =
      this.options.restartDelaySeconds || 15;

    await this.broadcast(
      `Server restarting in ${delaySeconds} seconds.`
    );

    await this.sendDiscord(
      `🟢 Round ended. Restarting in ${delaySeconds} seconds.`
    );

    await this.delay(
      delaySeconds * 1000
    );

    await this.restartServer();
  }

  async forceRestart() {

    this.restartPending = false;

    this.stopReminders();

    await this.broadcast(
      'Restart timeout exceeded. Restarting now.'
    );

    await this.sendDiscord(
      '🔴 Restart timeout exceeded. Forcing restart.'
    );

    await this.restartServer();
  }

  async restartServer() {

    this.verbose(
      1,
      'Attempting Pterodactyl restart...'
    );

    try {

      const response = await axios.post(
        `${this.options.pterodactyl.url}/api/client/servers/${this.options.pterodactyl.serverId}/power`,
        {
          signal: 'restart'
        },
        {
          headers: {
            Authorization:
              `Bearer ${this.options.pterodactyl.apiKey}`,

            Accept:
              'Application/vnd.pterodactyl.v1+json',

            'Content-Type':
              'application/json'
          }
        }
      );

      this.verbose(
        1,
        `Restart request successful. Status: ${response.status}`
      );

      await this.sendDiscord(
        '✅ Restart command sent successfully.'
      );

    } catch (err) {

      let pterodactylErrorCode = null;

      if (
        err.response &&
        err.response.data &&
        err.response.data.errors &&
        err.response.data.errors[0]
      ) {

        pterodactylErrorCode =
          err.response.data.errors[0].code;
      }

      if (
        pterodactylErrorCode ===
        'generic.daemon_connection_exception'
      ) {

        this.verbose(
          1,
          'Restart command appears accepted. Wings disconnected during restart.'
        );

        console.error(err.message);

        if (
          err.response &&
          err.response.data
        ) {

          console.error(
            JSON.stringify(
              err.response.data,
              null,
              2
            )
          );
        }

        await this.sendDiscord(
          '✅ Restart command sent. Panel reported a daemon disconnect during restart, but the server is restarting.'
        );

        return;
      }

      console.error(err.message);

      if (
        err.response &&
        err.response.data
      ) {

        console.error(
          JSON.stringify(
            err.response.data,
            null,
            2
          )
        );
      }

      this.verbose(
        1,
        `Restart failed: ${err.message}`
      );

      await this.sendDiscord(
        `❌ Restart failed: ${err.message}`
      );
    }
  }

  async broadcast(message) {

    this.verbose(
      1,
      `Sending broadcast: ${message}`
    );

    try {

      await this.server.rcon.execute(
        `AdminBroadcast ${message}`
      );

      this.verbose(
        1,
        `Broadcast successful: ${message}`
      );

    } catch (err) {

      console.error(err.message);

      this.verbose(
        1,
        `Broadcast failed: ${err.message}`
      );
    }
  }

  async sendDiscord(message) {

    if (!this.options.discordWebhook) {

      this.verbose(
        1,
        'Discord webhook not configured.'
      );

      return;
    }

    this.verbose(
      1,
      `Sending Discord webhook: ${message}`
    );

    try {

      const response = await axios.post(
        this.options.discordWebhook,
        {
          content: message
        }
      );

      this.verbose(
        1,
        `Discord webhook successful. Status: ${response.status}`
      );

    } catch (err) {

      console.error(err.message);

      if (
        err.response &&
        err.response.data
      ) {

        console.error(
          JSON.stringify(
            err.response.data,
            null,
            2
          )
        );
      }

      this.verbose(
        1,
        `Discord webhook failed: ${err.message}`
      );
    }
  }

  startReminders() {

    this.stopReminders();

    const minutes =
      this.options.reminderIntervalMinutes || 15;

    this.reminderInterval = setInterval(
      async () => {

        if (!this.restartPending) {

          this.stopReminders();
          return;
        }

        await this.broadcast(
          'Reminder: server restarting after this round!'
        );

      },
      minutes * 60 * 1000
    );
  }

  stopReminders() {

    if (this.reminderInterval) {

      clearInterval(
        this.reminderInterval
      );

      this.reminderInterval = null;
    }
  }

  delay(ms) {

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }
}

process.on(
  'unhandledRejection',
  (reason) => {

    console.error(
      'UNHANDLED REJECTION:',
      reason
    );
  }
);

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      'UNCAUGHT EXCEPTION:',
      err
    );
  }
);