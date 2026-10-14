# MongoDB Atlas Free setup (preparation only) — 2026-10-14

**Status: NOT PROVISIONED / NOT VERIFIED.** No authenticated Atlas management interface, approved cluster-creation request or local secure connection configuration has been established in this preparation session. No cloud resources or paid services were created. Provisioning requires the owner's explicit approval and interactive Atlas authentication; the steps here are for the owner to perform.

## Intended configuration (subject to choices actually offered in the Atlas UI)

| Setting | Planned value |
| --- | --- |
| Atlas project | `OneNode-ChargeGuard` |
| Cluster/deployment name | `ChargeGuardCluster` |
| Tier | **Free / M0 only** |
| Cloud | AWS |
| Region | **Singapore (`ap-southeast-1`) if listed for Free**; otherwise choose another Free region explicitly |
| Logical app database | `chargeguard` |
| Application collections | Planned for build phase, **not created yet** |
| Allowed network source | Owner's **current public IP /32** or exact secure range; avoid global `0.0.0.0/0` |

Documentation: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/ ; https://www.mongodb.com/docs/atlas/security/ip-access-list/ ; https://www.mongodb.com/docs/atlas/security-add-mongodb-users/ . Atlas Free availability, cloud choices and quotas can change; verify that the creation page displays **Free** and a zero-cost total before proceeding. Do not select paid backups, upgraded compute, dedicated network access, or paid add-ons.

## Exact owner actions using official UI

1. Sign in at **https://cloud.mongodb.com/** using your own account. Complete login verification/MFA if requested. Create project **OneNode-ChargeGuard** if absent.
2. Select **Build a Database / Create a Deployment** and choose **Free (M0)**. Choose **AWS** and **Singapore** only if the UI shows those as available for this free deployment. Name it **ChargeGuardCluster**. Review the final price; do not authorize a paid option. **Before actually creating cloud resources, give explicit approval** for the intended free configuration.
3. Under **Security → Database Access**, create a dedicated SCRAM database user for the app; use a unique strong password from a password manager. Avoid `atlasAdmin`/`root`/`readWriteAnyDatabase`. For the future demo app, `readWrite` on `chargeguard` is the minimum typical role for reading/writing its collections (index/collection creation may require extra privileges; perform schema creation manually or via a separate setup identity if needed). Do not share this password in chat, GitHub or screenshots.
4. Under **Security → Network Access**, choose **Add Current IP Address**. Confirm the address is your current public IP and restrict it to that address (`/32` for IPv4). If roaming IP changes, replace the entry after confirmation. Never use `0.0.0.0/0` just to make a test pass.
5. When the UI shows the Free cluster is ready, open **Connect** and choose **Drivers** or **Compass** to obtain your **non-secret cluster hostname**. Store the complete URI with credentials locally in `.env` (git-ignored) or a password manager. Escape password reserved characters per MongoDB URI rules. Never paste a populated URI into an issue, commit, chat or terminal output.
6. If wanting to verify before 17 Oct, only run `ping` and enumerate the databases visible to that user; creating `chargeguard` collections, indexes or writes belongs to the official development phase unless explicitly allowed as a pure connectivity probe. MongoDB materializes a database after its first write; seeing no `chargeguard` entry before that is normal.

## Credentials and secure connection verification (owner executes locally)

**Preferred via Compass:** install **MongoDB Compass** from https://www.mongodb.com/products/tools/compass . Use **New Connection**, paste the secret URI privately, connect with TLS (Atlas default), select the database list and note whether `chargeguard` exists (it can legitimately be absent). Do not export URI/config, screenshots displaying secrets, or stored passwords.

**Alternative using `mongosh`:** install from https://www.mongodb.com/try/download/shell , then use the sanitized hostname and user below (replace names locally):

```sh
# Password is prompted interactively and is never included in the command.
mongosh 'mongodb+srv://<cluster-hostname>/admin' --username '<db-user>' --authenticationDatabase admin
```

Within the `mongosh` REPL:

```javascript
db.adminCommand({ ping: 1 })
db.getMongo().getDBNames()  // shows only databases the user may list
db.runCommand({ connectionStatus: 1, showPrivileges: false }) // inspect roles locally, redact before sharing
```

Expected **future** observations if authorized and connected: `ping: { ok: 1 }`, server accepted authentication, accessible DBs listed, and role scoped to `chargeguard` if an app identity is used. These are *acceptance criteria*, **not completed test results**. Verify `readWrite` on `chargeguard` from the Atlas Database Access UI if privileges cannot be listed with the scoped user.

Potential connection blockers: cluster not created/ready, password mismatch, SRV/DNS failure, local firewall, unavailable Free region or missing current IP access-list entry. Fix in Atlas UI without bypassing authentication or broadening access unnecessarily.

## Status log

| Check | Status | Evidence |
| --- | --- | --- |
| Authenticated Atlas account | **UNVERIFIED** | No authenticated management session provided |
| Project and Free cluster created | **NOT ATTEMPTED** | Explicit pre-provision approval required |
| AWS Singapore eligible for Free | **UNVERIFIED** | Verify region options within UI |
| Database user created | **NOT ATTEMPTED** | Owner must provision securely |
| Restricted IP access list | **NOT ATTEMPTED** | Owner must check public IP |
| Compass / mongosh connectivity | **BLOCKED** | Requires cluster, network rule and credentials |
| `ping`, database enumeration, permissions | **BLOCKED** | No authenticated connection established |

After the owner completes setup, update this file with sanitized date/time, selected free region, connection method, result and any error **without exposing hosts that should remain private, credentials or identifying IP addresses**.
