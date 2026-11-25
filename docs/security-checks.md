# Security checks

What was checked on the live Supabase project, how, and what came back. These were one-off
runs from scripts on my own computer, not part of CI (CI runs the 15 unit tests for `logic.js`).
Each run created a throwaway account with a random password kept only in memory, so no
credentials appear here or in the repo.

## 1. Data isolation between users (Row Level Security): 24 November 2026, 10/10

**Setup.** With my own account (A), I created a company named `ISOLATION TEST` in the app.
A second, throwaway account (B) was then created through the Supabase Auth API with the
public (publishable) key, the same access any visitor to the site has. Every check below was
a direct API call as B, not a click in the app, so the app's own filters played no part: only
the database policies did.

| # | What account B tried | Expected | Result |
|---|---|---|---|
| 1 | Read all rows of `companii` | none of A's rows | `[]` |
| 2 | Read all rows of `aplicari` | none of A's rows | `[]` |
| 3 | Read all rows of `cv_versiuni` | none of A's rows | `[]` |
| 4 | Search `companii` for the name `ISOLATION TEST` | not found | `[]` |
| 5 | Rename `ISOLATION TEST` | 0 rows changed | 0 rows |
| 6 | Delete `ISOLATION TEST` | 0 rows deleted | 0 rows |
| 7 | Insert a company with another user's `user_id` | refused | HTTP 403 |
| 8 | Insert a company with its own `user_id` | allowed | 1 row created |
| 9 | Delete that own company (cleanup) | allowed | 1 row deleted |
| 10 | Read `companii` as an anonymous visitor (no login) | nothing | `[]` |

Checks 8 and 9 are the control: they show that the refusals in 5-7 come from who owns the
row, not from a broken setup that refuses everything. Afterwards I opened the app as A and
`ISOLATION TEST` was still there, unchanged. The test account was removed from Auth the same day.

## 2. Delete account: 24 November 2026

The *Delete account* button calls `delete_my_account()` ([`supabase/delete_my_account.sql`](../supabase/delete_my_account.sql)),
which acts only on the account calling it.

**Through the API, 7/7:**

| # | Check | Result |
|---|---|---|
| 1 | An anonymous visitor calls `delete_my_account()` | refused, HTTP 401 |
| 2 | A fresh test account adds 1 company, 1 application and 1 resume version | all 3 saved |
| 3 | That account calls `delete_my_account()` | succeeds, HTTP 204 |
| 4 | Its rows in `companii` afterwards | none |
| 5 | Its rows in `aplicari` afterwards | none |
| 6 | Its rows in `cv_versiuni` afterwards | none |
| 7 | Logging in again with that account | refused |

Checks 4-6 used the old access token, which still passes the signature check after the
account is gone, so an empty answer means the rows were really deleted, not just hidden.

**In the app, 13/13** (headless Edge, a local copy of the app against the live database):

1. In demo mode, *Delete account* is hidden.
2. A new account registers and logs in through the app's own form.
3. Signed in, *Delete account* is visible.
4. A company is saved and listed.
5. At 390 px wide, the header with the extra button has no sideways scroll and the button stays on screen.
6. The confirmation window's main button reads *Delete my account* and starts disabled.
7. The window names the account being deleted.
8. Typing `DELET` keeps the button disabled.
9. Typing `DELETE` enables it.
10. After deleting: back on the login screen, with a confirmation message.
11. The deleted account can't log in.
12. The shared demo account logs in, and *Delete account* is hidden for it.
13. No JavaScript errors during the run.

## Not checked

- **The shared demo account's protection was not tested by calling the function as that
  account**, because if the protection failed, the demo account would be deleted. Checked by
  reading instead: the ID refused in the SQL is the demo account's, and the button is hidden for it (check 12).
- **[`supabase/aplicari_own_company.sql`](../supabase/aplicari_own_company.sql)** (an application can only point to one of your
  own companies, added 25 November 2026) was not tested on the live database with two
  accounts; it was checked by reading the policy.
- These checks ran once each. Nothing re-runs them automatically after a change to the policies.
