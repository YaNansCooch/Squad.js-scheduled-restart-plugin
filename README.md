# ScheduledRestart Plugin

A SquadJS plugin that performs automated daily server restarts.

The plugin:

* Schedules a restart at a configurable daily time
* Waits for the current round to end
* Delays restart for scoreboard viewing
* Sends in-game AdminBroadcast warnings
* Sends Discord webhook notifications
* Restarts the server through the Client API
* Falls back to a forced restart if no round ends within the configured timeout
* Repeats reminder broadcasts while waiting

---

# Features

## Scheduled Daily Restart

The plugin checks the configured restart time every 30 seconds.

Example:

```json
"restartTime": "04:00"
```

---

## Wait For Round End

Once the restart window opens:

* Server Broadcast is sent
* Discord receives a webhook notification
* The plugin waits for the `ROUND_ENDED` SquadJS event

---

## Scoreboard Delay

After `ROUND_ENDED` fires:

* A configurable delay occurs
* Players can view the end-of-round scoreboard
* Restart begins after the delay expires

Example:

```json
"restartDelaySeconds": 15
```

---

## Restart Window Timeout

If no round ends within the configured limit:

```json
"maxWaitHours": 2
```

The plugin forces the restart automatically.

---

## Repeated Reminder Broadcasts

While waiting for the round to end:

* Repeated broadcasts are sent in-game

Example:

```json
"reminderIntervalMinutes": 15
```

---

# Installation

## 1. Install Plugin File

Place the plugin file here:

```text
/home/container/squad-server/plugins/scheduled-restart.js
```

---

## 2. Install Axios

Inside the SquadJS container:

```bash
npm install axios
```

---

## 3. Add config object to config.json

Inside your SquadJS config:

```json
{
      "plugin": "ScheduledRestart",
      "enabled": true,
      "restartTime": "00:00",
      "timezone": "IANA_Timezone",
      "reminderIntervalMinutes": 15,
      "maxWaitHours": 2,
      "restartDelaySeconds": 15,
      "discordWebhook": "Discord_Webhook_URL",
      "pterodactyl": {
        "url": "ContainerURL",
        "apiKey": "Your_API_Key",
        "serverId": "ServerID"
    }
      
 }

```

IMPORTANT:

* Plugin name must be `ScheduledRestart`
* Time must use 24-hour format

---

## Finding Server ID

Example panel URL:

```text
https://panel.example.com/server/abcd1234
```

Server ID:

```text
abcd1234
```

Do NOT use the full UUID.

---

# Discord Webhook Setup

Create a Discord webhook inside the target channel:

```text
Channel Settings
→ Integrations
→ Webhooks
→ New Webhook
```

Paste the webhook URL into:

```json
"discordWebhook": "https://discord.com/api/webhooks/..."
```

---

# Timezone Configuration

Use valid IANA timezone names.

Examples:

```json
"timezone": "America/Halifax"
```

```json
"timezone": "America/New_York"
```

```json
"timezone": "Europe/London"
```

Avoid abbreviations like:

```text
EST
PST
AST
```

---

# Example Workflow

At configured restart time:

```text
04:00
```

The plugin:

1. Opens restart window
2. Sends in-game warning
3. Sends Discord notification
4. Waits for ROUND_ENDED
5. Waits scoreboard delay
6. Sends restart request to Pterodactyl
7. Sends success/failure notification

---

# Console Logging

The plugin logs:

* Schedule checks
* Broadcast attempts
* Discord webhook status
* Restart attempts
* Pterodactyl API responses
* Errors and stack traces

Useful logs include:

```text
ScheduledRestart mounted.
```

```text
Restart window opened.
```

```text
ROUND_ENDED fired.
```

```text
Attempting Pterodactyl restart...
```

```text
Restart request successful.
```

---

# Daemon Disconnect Handling

Some Pterodactyl installations return:

```text
generic.daemon_connection_exception
```

when Wings disconnects during restart.

The plugin treats this as a successful restart request and logs the event instead of failing.

---

# Troubleshooting

## Plugin Does Not Exist

Ensure config uses:

```json
"plugin": "ScheduledRestart"
```

NOT:

```json
"plugin": "scheduled-restart"
```

---

## No Restart Time Configured

Ensure `optionsSpecification` exists inside the plugin.

---

## Broadcasts Not Working

Verify:

* Squad RCON is connected
* `AdminBroadcast` works manually
* SquadJS has RCON access

---

## Discord Webhook Failing

Verify:

* Webhook URL is correct
* Channel still exists
* Discord has not revoked the webhook

---

## Restart API Failing

Verify:

* Pterodactyl URL is correct
* API key is valid
* Server ID is correct
* Client API permissions include power control
