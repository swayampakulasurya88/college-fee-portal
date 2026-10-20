# Database backup & restore

The portal's data lives in a MongoDB Atlas **free (M0)** cluster. Free clusters
have **no automatic backups**, so the repository runs its own daily backup:

- **What:** `mongodump` of the whole `college_fee` database (students, payments,
  term fees, mess bills, messages, duplicate attempts).
- **When:** every day at **02:00 UTC** (07:30 IST), plus on demand.
- **Where:** a **GitHub Actions artifact**, encrypted with AES-256.
- **Retention:** **90 days** (GitHub's maximum for free artifacts). Because it
  runs daily, you always have the last 90 days available.
- **Size:** ~15 KB today, so 90 days is well under 2 MB.

The backup is **encrypted before it leaves the runner**. The plaintext archive
never leaves the machine and is deleted immediately.

---

## One-time setup (5 minutes)

You must add two repository secrets. They are encrypted at rest by GitHub and
are never printed in logs.

1. Open the repo on GitHub → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
2. Add **`MONGODB_URI`**
   - Value: your MongoDB Atlas connection string
     (`mongodb+srv://<user>:<password>@cluster0.../college_fee?...`).
   - This is the same value as `MONGODB_URI` in Render.
3. Add **`BACKUP_PASSPHRASE`**
   - Generate a strong one on your computer:

     ```bash
     openssl rand -base64 32
     ```

   - Paste the output as the secret value.
   - **Save it in a password manager.** Without it, encrypted backups cannot be
     restored. There is no recovery mechanism.

## Verify it works

1. GitHub → **Actions** → **Daily database backup** → **Run workflow**.
2. Wait ~1 minute; the run should be green.
3. Open the run → **Artifacts** → `db-backup-<run-id>` → download.
4. You should get a single `college_fee-YYYY-MM-DD_HHMM.archive.gpg` file.

If it fails with *Missing MONGODB_URI secret*, re-check step 2 above.

---

## Download a backup

**Via the website:** Actions → *Daily database backup* → pick a run →
**Artifacts** → download.

**Via the GitHub CLI** (if installed):

```bash
gh run list --workflow=backup.yml
gh run download <run-id> -n db-backup-<run-id>
```

---

## Restore

> ⚠️ Restoring **over** the live database overwrites data. Always restore to a
> scratch database first and check it.

### 1. Decrypt

```bash
gpg --batch --decrypt \
  --output college_fee.archive \
  college_fee-2026-10-20_0200.archive.gpg
```

You will be prompted for `BACKUP_PASSPHRASE`.

### 2. Restore into a scratch database (safe check)

```bash
export MONGODB_URI='mongodb+srv://...'

mongorestore --uri="$MONGODB_URI" \
  --archive=college_fee.archive --gzip \
  --nsFrom='college_fee.*' --nsTo='college_fee_restore.*'
```

Verify the counts (Atlas UI → browse `college_fee_restore`) or:

```bash
mongosh "$MONGODB_URI" --eval '
  const d = db.getSiblingDB("college_fee_restore");
  print("students:", d.students.countDocuments());
  print("payments:", d.payments.countDocuments());
  print("termfees:", d.termfees.countDocuments());
'
```

### 3. Restore over the live database (disaster recovery)

1. **Pause writes** if possible (Render → suspend the service, or tell admins
   not to use the portal while restoring).
2. Run:

   ```bash
   mongorestore --uri="$MONGODB_URI" \
     --archive=college_fee.archive --gzip --drop
   ```

   `--drop` replaces each collection contained in the archive with the backup
   version.
3. Resume the service and spot-check a student with a known balance.

### Validate without writing

```bash
mongorestore --uri="$MONGODB_URI" --archive=college_fee.archive --gzip --dryRun
```

---

## Good practices

- Keep at least one backup downloaded **outside GitHub** (e.g. an encrypted USB
  drive or your Google Drive) once a month. GitHub artifacts expire after 90
  days.
- Re-test a restore every few months. A backup you have never restored is only
  a hope.
- If you ever change the Atlas password, update the `MONGODB_URI` secret too.
- Never commit the connection string, the passphrase, or a decrypted archive to
  the repository (it is public).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Missing MONGODB_URI secret` | Secret not added (see setup) |
| `Authentication failed` | Atlas password changed — update the secret |
| `server selection timeout` | Atlas network access list blocks GitHub runners. Add `0.0.0.0/0` to Atlas → Network Access (or allow GitHub's ranges). |
| Workflow stopped running | GitHub disables schedules after 60 days of inactivity. The monthly *Keep scheduled workflows enabled* job prevents this; if it ever stops, run it manually once. |
| `gpg: decryption failed: Bad session key` | Wrong passphrase |
