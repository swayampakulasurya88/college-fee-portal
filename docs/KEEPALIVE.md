# Keeping the site awake (free)

Render's **free** web service spins down after ~15 minutes without traffic. The
next visitor then waits **30–60 seconds** for a cold start.

There is a GitHub Actions job (`.github/workflows/keepalive.yml`) that pings
`/api/health` every 10 minutes, but **GitHub heavily throttles scheduled
workflows on free/public repos**. In practice it ran only ~5 times a day
(observed gaps of 4–5 hours), so the site still slept.

**The reliable fix is an external monitor** that pings the health endpoint every
5 minutes. It lives outside GitHub, so nothing throttles it.

---

## Option A — UptimeRobot (recommended)

Free plan: 50 monitors, 5-minute checks, email alerts.

1. Sign up at <https://uptimerobot.com> (free).
2. **Add New Monitor**.
3. Set:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `KIET Fee Portal`
   - **URL:** `https://kiet-fee-portal.onrender.com/api/health`
   - **Monitoring Interval:** `5 minutes`
4. Under **Alert Contacts**, tick your email.
5. **Create Monitor**.

That's it. The monitor now:

- keeps the Render instance warm 24/7, and
- **emails you if the site goes down** (a free uptime alert).

### Verify

Wait 20+ minutes without visiting the site, then open
<https://kiet-fee-portal.onrender.com>. It should load in ~1–2 seconds rather
than ~30.

---

## Option B — cron-job.org

Free, can run as often as every minute.

1. Sign up at <https://cron-job.org>.
2. **Create cronjob**.
3. URL: `https://kiet-fee-portal.onrender.com/api/health`
4. Schedule: **every 5 minutes**.
5. Enable **Save responses** = off, and set a timeout of ~60 s.
6. Create.

---

## Option C — paid Render (only if you need a guarantee)

Render's paid instance (~$7/month) never sleeps, so no pinger is needed. This is
the only option that guarantees instant response without relying on a third
party, but it is not required — Option A is enough for a college portal.

---

## Things to know

- **5 minutes is the right interval.** Render sleeps after 15 minutes, so any
  interval below 15 works. Pinging every minute is unnecessary and can get a
  free monitor rate-limited.
- **Free instance hours:** keeping the service awake 24/7 uses ~730 of Render's
  750 free hours/month. That fits, but with little margin — do not run a second
  free service on the same account.
- **Do not delete the monitor.** If it is removed, cold starts return.
- The repository keep-alive workflow is kept as a harmless fallback, but the
  external monitor is what actually does the work.
- If you change the domain, update the monitor URL.
