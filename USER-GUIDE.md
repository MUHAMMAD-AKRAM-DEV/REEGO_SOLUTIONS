# Using the system

A guide for everyone at the agency — billers, AR callers, credentialing
specialists, team leads and managers.

---

## What this system is for

It holds **who your clients are, who their providers are, what expires when,
and who is doing what**. It is the shared record that replaces the
spreadsheets.

It is **not** where you work claims. You still log into each practice's own
system — AdvancedMD, Kareo, eClinicalWorks — to enter charges, post payments
and work denials. This system tells you *what* needs doing, *for whom*, and
*by when*; you then go and do it in the practice's software and come back to
record the outcome.

If you remember one thing: **look here first, work there, record it back
here.**

---

## Signing in

Go to the address your administrator gave you and enter your email and
password.

Accounts are created for you. There is no sign-up link, and there never will
be — that is deliberate for a system holding patient information.

**Some things worth knowing:**

- You are signed out automatically after **12 hours**. Signing in again is
  normal, not a fault.
- **Five wrong passwords locks the account for 15 minutes.** If you have
  forgotten yours, ask an administrator rather than guessing — guessing just
  locks you out.
- **Everything you do is recorded**, including records you only *look at*.
  That is a legal requirement for patient information, not distrust. It also
  protects you: if a record changes, the log shows who changed it.

---

## Finding your way around

The left-hand menu is in three parts:

**Registry** — the facts. Who your clients are, their providers, and the
payers everyone bills.

**Operations** — the work. Documents, credentialing, enrollment, work queues.

**Administration** — import, and the audit log.

Anything greyed out with a number beside it is a module that has not been
built yet. The number is the phase it is planned for.

---

## The screens

### Overview

Where the business stands today and what changed recently. Start your day
here.

### Clients

Every practice the agency bills for. Click a practice name to open it.

A client's page shows its contracted services with the turnaround agreed for
each, its providers, and its locations. It also records **which system your
staff work claims in** for that practice — so nobody has to ask.

### Providers

Every physician, nurse practitioner and PA across the whole book.

Click a provider's name to open **their full record** — identity and NPI, every
credential with days remaining, every payer they are enrolled with, open work,
and documents on file. This one page replaces opening four spreadsheets.

> The same physician working for two of your practices appears **twice**, once
> under each. That is correct, not a duplicate: each relationship is
> credentialed and enrolled with payers separately, on its own timeline.

### Payers

The insurance companies, shared across all clients rather than copied per
practice — that is what lets you see which payer denies you most across the
whole book.

### Documents

Superbills, EOBs, payer letters, appeal packets, certificates.

Upload with **Upload document**, attach it to a client or a provider, and give
it a category. Click any document title to download it.

**Uploading a replacement does not overwrite the old one.** It creates a new
version and keeps the previous one, because "what did the certificate say last
year" is a real question during an audit.

### Credentialing

**The most important screen in the system.** Every licence, DEA registration,
board certificate, malpractice policy and CAQH attestation that has an expiry
date, across every provider, sorted so the thing that lapses soonest is at the
top.

Each row has a **runway bar** on the right. Read the shape:

| Looks like | Means |
|---|---|
| Long green bar | Comfortable, no action needed |
| Half-length ochre bar | Should be in progress |
| Short red sliver | Urgent — too late for most renewals |
| Hatched red bar | **Already expired** |

The four buttons at the top — Overdue, 30 days, 90 days, 180 days — narrow the
list. **Overdue is the one to check every morning.**

> A credential that lapses does not send a warning. It produces an unpaid claim
> and often a clawback of money you were already paid. This screen exists so
> that never happens.

### Enrollment

Which providers are enrolled with which payers, and where each application has
got to.

Statuses run: *not started → preparing → submitted → under review → info
requested → approved → effective*.

**Only "approved" and "effective" mean you can actually bill for that
provider.** The "Billable" count at the top is deliberately separate from the
total for that reason.

The **Follow up** column shows when to chase the payer next, with the same
runway bar. Anything showing "late" needs a call today.

### Work queues

What the team is working on. AR follow-up, denials, charge entry,
credentialing tasks.

Finished work is hidden by default — change the **Status** filter to see it.

Click an item to open it. On the item page you can:

- **Take this** — claims an unassigned item for yourself
- **In progress / Waiting on payer / Waiting on client / Blocked / Done** —
  one click, no form
- **Edit** — to change detail, amounts, due dates

For AR and denial work, record the **claim reference**, the **denial code** as
the payer gave it, and the **amount at risk**. Older money is harder to
collect, so the AR age bucket carries its own colour.

### Audit log

Who did what, when, and from which address. Managers and quality auditors only.

---

## Finding things

Every list works the same way.

**Search** — type in the search box. It looks across the sensible fields for
that screen: provider names, licence numbers, claim references, payer names.
Results narrow as you type.

**Filter** — the dropdowns above each list. They combine, so you can ask for
"credentialing queue, overdue, owned by Sara".

**Sort** — click any column heading. Click it again to reverse.

**Share what you are looking at.** The filters live in the web address, so you
can copy the URL out of the address bar and paste it to a colleague. They will
see exactly the same rows. This is the fastest way to hand over a worklist.

---

## Common tasks

### Add a new client practice

**Clients → Add client.** Only the practice name is required; fill in what you
know and come back for the rest.

Then open the client and use **Add location** for each site, and **Add
provider** for each physician.

### Add a provider

**Providers → Add provider**, or **Add provider** from inside a client.

You must choose which practice they work under. If the NPI is rejected, the
number is wrong — see [When the system says no](#when-the-system-says-no).

### Start tracking a credential

**Credentialing → Add credential**, or the **Add** link on a provider's record,
which pre-fills the provider for you.

Choose the type, enter the number and issuer, and — most importantly — the
**expiry date**. That date is what puts the item on the expirables screen.

### Record a payer enrollment

**Enrollment → Add enrollment.** Pick the provider and the payer, and set the
status to where the application actually is.

As it progresses, open it and update the status. When the payer approves it,
record the **PTAN or provider ID** they issue — you will need it later and it
is painful to retrieve.

### Bring your existing spreadsheets across

**Administration → Import.** Works for clients, providers and credentials.

1. Choose what the sheet contains
2. Pick the file (.xlsx, .xls or .csv — first row must be column headings)
3. Press **Check the file**

You then see exactly what will happen: which columns were recognised, how many
rows are ready, and **every problem row with its Excel row number and the
reason**. Nothing is written until you press Import.

**You do not need to reformat your spreadsheet first.** Headings are matched
loosely — "Provider NPI", "NPI" and "Individual NPI" all work, and so do
dates written as 3/14/2025.

Import clients first, then providers (they need a practice to attach to), then
credentials.

Rows that already exist are skipped, not duplicated — so you can fix the
problem rows and import the same file again safely.

---

## Things that work differently from Excel

### Nothing gets deleted

There is no delete button anywhere, on purpose.

| Instead of deleting | You |
|---|---|
| A practice you no longer bill for | Set its status to **Offboarded** |
| A provider who has left | **Deactivate** them |
| A credential no longer relevant | **Retire** it |
| An out-of-date document | Upload a **new version** |

Everything stays visible and reversible. In a spreadsheet you would delete the
row; here, claims history, credentials and the audit log all point at those
records, and a provider who left last year still has history that has to be
reconstructable if you are audited.

### Bad data is refused at entry

NPIs carry a built-in check digit, so the system can tell a real NPI from a
mistyped one. Type a transposed number and it is rejected immediately, rather
than coming back as a claim rejection three weeks later.

Emails and dates are checked the same way.

### Two people can work at once

No more "someone has the file open". Everyone sees the same data, updated as it
changes.

---

## When the system says no

| Message | What it means |
|---|---|
| *"That is not a valid NPI"* | Two digits are probably swapped. Check it against the source document. |
| *"Too many attempts, locked for 15 minutes"* | Five wrong passwords. Wait, or ask an administrator. |
| *"Already has an enrollment with that payer"* | One already exists — find and edit it rather than making a second. |
| *"An effective date only makes sense once the status is effective"* | Set the status first, then the date. |
| *"You do not have permission"* | Your role does not cover that. Ask a team lead. |

**If a form is rejected, your typing is kept.** Fix the highlighted field and
submit again — you do not have to retype the rest.

---

## Who can do what

| Role | Can |
|---|---|
| **Administrator** | Everything, including managing people |
| **Manager** | Manage clients, providers, payers; assign work; view the audit log; export |
| **Team lead** | Manage providers, assign work, run quality audits |
| **Credentialing specialist** | Manage providers, credentials and enrollments |
| **Biller / AR caller** | View the registry, work their assigned items |
| **Quality auditor** | View everything, plus the audit log |
| **Client portal** | Their own practice only — never another client's data |

---

## Good habits

**Check Credentialing → Overdue first thing.** It takes ten seconds and it is
the screen with money attached.

**Update a work item when you touch it**, not at the end of the week. The queue
is only useful if it reflects reality.

**Record the PTAN the moment a payer issues it.** Retrieving it later means a
phone call and a hold queue.

**Never put patient names or clinical details in a notes field.** Notes are for
what you did and what happens next — "called Aetna, they want the W-9 again",
not patient information.

**Paste a filtered URL instead of describing a worklist.** Faster and less
error-prone than explaining which rows you meant.

---

## Getting help

Ask your administrator or team lead first — most issues are a role permission
or a locked account.

If something looks wrong with the data itself, the **Audit log** will usually
show what happened and who did it.
