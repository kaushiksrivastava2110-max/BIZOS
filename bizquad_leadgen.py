#!/usr/bin/env python3
"""
Bizquad Lead Generation Agent
==============================
Two-step daily workflow, run from your terminal:

  1. DISCOVER  ->  python3 bizquad_leadgen.py discover
     Finds India companies actively hiring in Bizquad's specialty areas,
     qualifies them with Claude, finds a decision-maker via Clodura, drafts
     personalized outreach, and writes everything to leads.csv with an
     empty "approved" column.

  2. REVIEW    ->  Open leads.csv (Excel/Numbers/Sheets). For every row you
     want sent, type "yes" in the approved column. Leave the rest blank.
     Aim for 50-70 "yes" rows for a full day's batch.

  3. SEND      ->  python3 bizquad_leadgen.py send
     Sends only the "yes" rows via your Outlook mailbox (Microsoft Graph
     API), with a short delay between sends, and logs status + timestamp
     back into the CSV so nothing gets double-sent on a re-run.

Setup:
  pip install requests anthropic msal --break-system-packages

  export ANTHROPIC_API_KEY="sk-ant-..."
  export CLODURA_API_KEY="your-clodura-key"
  export CLODURA_BASE_URL="https://api.clodura.ai"   # confirm against your Clodura dashboard

  # Microsoft Graph app-only auth (same style as your JD Inbox pipeline).
  # Needs an Azure AD app registration with Mail.Send application permission,
  # admin-consented, and MS_SENDER_EMAIL must be a mailbox that app can send as.
  export MS_TENANT_ID="..."
  export MS_CLIENT_ID="..."
  export MS_CLIENT_SECRET="..."
  export MS_SENDER_EMAIL="you@bizquad.co.in"

Notes:
  - Nothing is ever sent without a "yes" in the approved column. There's no
    fully-automatic send path by design.
  - Clodura's Fair Use Policy prohibits permanent storage of their data
    (24h cache max). Treat leads.csv as disposable working output — archive
    or delete old rows regularly, don't build a permanent database from it.
  - Rate limits: Clodura allows up to 10 req/sec on paid plans; Graph mail
    send is throttled per mailbox, so sends are spaced out below.
"""

import os
import csv
import sys
import json
import time
import random
import requests
from datetime import datetime, date
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CLODURA_API_KEY = os.environ["CLODURA_API_KEY"]
CLODURA_BASE_URL = os.environ.get("CLODURA_BASE_URL", "https://api.clodura.ai")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

CLODURA_HEADERS = {"x-api-key": CLODURA_API_KEY, "Content-Type": "application/json"}
claude = Anthropic(api_key=ANTHROPIC_API_KEY)
CLAUDE_MODEL = "claude-sonnet-4-6"

# Bizquad's ICP — India only
ICP_FILTERS = {
    "organisationCountry": ["India"],
    "organisationEmployeeSize": ["51 - 200", "201 - 500", "501 - 1000", "1001 - 5000"],
    "industry": ["Information Technology & Services", "Computer Software"],
    "perPage": 100,
    "page": 1,
}

FIT_THRESHOLD = 55                  # lower slightly vs a single-pass run, to hit 50-70 leads/day
MAX_COMPANIES_TO_PROCESS = 150      # raise/lower based on Clodura credit budget
SEND_DELAY_SECONDS = 8              # spacing between outbound sends
OUTPUT_PATH = os.path.expanduser("~/bizquad_leads/leads.csv")
SENT_LOG_PATH = os.path.expanduser("~/bizquad_leads/sent_log.csv")

CSV_FIELDS = [
    "company", "domain", "location", "fit_score", "urgency_score", "signal",
    "target_title", "contact_name", "contact_title", "contact_email",
    "contact_linkedin", "linkedin_note", "email_subject", "email_body",
    "approved", "status", "sent_at",
]


# ---------------------------------------------------------------------------
# Sent log — prevents re-contacting the same person across daily runs
# ---------------------------------------------------------------------------

SENT_LOG_FIELDS = ["company", "contact_name", "contact_email", "sent_at"]

def load_sent_log():
    """Returns a set of (company, contact_name) already contacted."""
    if not os.path.exists(SENT_LOG_PATH):
        return set()
    with open(SENT_LOG_PATH, newline="", encoding="utf-8") as f:
        return {(r["company"], r["contact_name"]) for r in csv.DictReader(f)}

def append_sent_log(rows):
    """Appends successfully sent rows to the persistent sent log."""
    os.makedirs(os.path.dirname(SENT_LOG_PATH), exist_ok=True)
    write_header = not os.path.exists(SENT_LOG_PATH)
    with open(SENT_LOG_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=SENT_LOG_FIELDS)
        if write_header:
            writer.writeheader()
        for r in rows:
            writer.writerow({
                "company": r["company"],
                "contact_name": r["contact_name"],
                "contact_email": r["contact_email"],
                "sent_at": r["sent_at"],
            })


# ---------------------------------------------------------------------------
# Clodura calls
# ---------------------------------------------------------------------------

def clodura_post(path, body):
    r = requests.post(f"{CLODURA_BASE_URL}{path}", headers=CLODURA_HEADERS, json=body, timeout=30)
    if r.status_code == 402:
        raise SystemExit("Clodura credits exhausted — stopping run. Check your usage/billing.")
    if r.status_code in (429, 409):
        print("  Rate limited, sleeping 5s...")
        time.sleep(5)
        return clodura_post(path, body)
    r.raise_for_status()
    return r.json()


def search_organizations():
    # Rotate starting page daily so each day pulls a different slice of Clodura's 10k pages.
    # Seed with today's date for reproducibility within a day (re-runs get the same batch).
    # Fetch page 1 first to discover the real total page count for our filters
    first = clodura_post("/api/v1/organisation/search", {**ICP_FILTERS, "page": 1})
    total_pages = first.get("pagination", {}).get("totalPages", 1)

    rng = random.Random(date.today().isoformat())
    page_pool = list(range(1, total_pages + 1))
    candidates = rng.sample(page_pool, min(5, len(page_pool)))

    print(f"Searching Clodura for India companies matching ICP ({total_pages} pages available)...")
    for page in candidates:
        filters = {**ICP_FILTERS, "page": page}
        print(f"  Trying page {page}...")
        try:
            data = clodura_post("/api/v1/organisation/search", filters)
            return data.get("organisation") or data.get("organisations") or data.get("organizations") or []
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code in (404, 500):
                print(f"  Page {page} errored, trying next...")
                continue
            raise

    # fallback: return whatever was on page 1
    return first.get("organisation") or first.get("organisations") or first.get("organizations") or []


def search_people(org_id, titles):
    body = {
        "organizationId": org_id,
        "personTitle": titles,
        "includeSimilarTitles": True,
        "seniority": ["C-Suite", "VP", "Director", "Manager", "Head"],
        "personCountry": ["India"],
        "page": 1,
        "perPage": 5,
    }
    try:
        data = clodura_post("/api/v1/search/people", body)
        return data if isinstance(data, list) else data.get("people", data.get("results", []))
    except requests.HTTPError:
        return []


# ---------------------------------------------------------------------------
# Claude calls
# ---------------------------------------------------------------------------

def qualify_lead(org):
    prompt = f"""You are qualifying a B2B lead for Bizquad Consultants, a specialist IT
recruitment firm placing senior/niche tech talent (SAP, Cloud, Full Stack,
Data/AI, GenAI, Salesforce, ServiceNow, DevOps) at 15 LPA+ in India.

Company: {org.get('organisationName')}
Industry: {org.get('industry')}
Size: {org.get('organisationEmployeeSize')}
Location: {org.get('organisationCity')}, {org.get('organisationCountry')}
Description: {(org.get('description') or '')[:500]}

Based on the company profile, assess how likely they are to need specialist IT
recruitment in Bizquad's areas. A mid-to-large India IT/software firm is a
strong fit. Score urgency based on company size and growth signals in the description.

Return ONLY a JSON object, no other text:
{{
  "fit_score": <0-100 integer, ICP fit>,
  "urgency_score": <0-100 integer, likelihood they are actively scaling tech headcount>,
  "signal_summary": "<one sentence on why this company is a likely hiring prospect>",
  "target_title": "<the HR/TA title most likely to own hiring decisions here, e.g. 'Head of Talent Acquisition'>"
}}"""

    resp = claude.messages.create(model=CLAUDE_MODEL, max_tokens=300,
                                   messages=[{"role": "user", "content": prompt}])
    text = resp.content[0].text.strip().strip("```json").strip("```")
    return json.loads(text)


def draft_outreach(org, contact, signal_summary):
    contact_name = contact.get("fullName") or f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip()
    contact_title = contact.get("position", "")

    prompt = f"""You are writing outreach ON BEHALF OF Kaushik Srivastava, Co-Founder of
Bizquad Consultants (specialist IT/tech recruitment firm, clients include KPMG,
Cognizant, L&T). Kaushik is reaching out TO the contact below.

SENDER: Kaushik Srivastava, Co-Founder, Bizquad Consultants
RECIPIENT: {contact_name}, {contact_title} at {org.get('organisationName')}
Company signal: {signal_summary}

Write the email in EXACTLY this structure — no deviations:

Line 1: One sentence on the pain point firms like theirs face when scaling the
specific tech area mentioned in the signal (Cloud, AI, SAP, DevOps etc.).

Line 2: "At Bizquad, we've solved this for KPMG, Cognizant, and L&T — significantly
cutting time-to-hire on niche tech roles."

Line 3: One highly specific sentence on why {org.get('organisationName')} in
particular — tie it directly to the company signal. No generic phrases.

Line 4: "Would [Day] [Time] or [Day] [Time] work for a quick 15-minute call?"
(Pick two realistic near-future weekday slots.)

Then this exact signature on new lines:
Best,
Kaushik Srivastava
Co-Founder, Bizquad Consultants
+91 9044 686419

Also write a LinkedIn connection note FROM Kaushik TO {contact_name} (under 300
chars). Same tone — direct, peer-level, no AI filler phrases.

Return ONLY a JSON object:
{{"linkedin_note": "...", "email_subject": "...", "email_body": "..."}}"""

    resp = claude.messages.create(model=CLAUDE_MODEL, max_tokens=500,
                                   messages=[{"role": "user", "content": prompt}])
    text = resp.content[0].text.strip().strip("```json").strip("```")
    return json.loads(text)


# ---------------------------------------------------------------------------
# Microsoft Graph (Outlook send)
# ---------------------------------------------------------------------------

def get_graph_token():
    tenant = os.environ["MS_TENANT_ID"]
    client_id = os.environ["MS_CLIENT_ID"]
    client_secret = os.environ["MS_CLIENT_SECRET"]
    url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def send_via_graph(token, to_email, subject, body_text):
    sender = os.environ["MS_SENDER_EMAIL"]
    url = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body_text},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": True,
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {token}"}, json=payload, timeout=30)
    r.raise_for_status()


# ---------------------------------------------------------------------------
# Discover
# ---------------------------------------------------------------------------

def cmd_discover(limit=MAX_COMPANIES_TO_PROCESS):
    already_contacted = load_sent_log()
    if already_contacted:
        print(f"Loaded sent log: {len(already_contacted)} contacts already reached — will skip them.")

    orgs = search_organizations()[:limit]
    print(f"Found {len(orgs)} candidate companies. Checking hiring signals...\n")

    rows = []
    for i, org in enumerate(orgs, 1):
        name = org.get("organisationName", "Unknown")
        print(f"[{i}/{len(orgs)}] {name}")

        qual = qualify_lead(org)
        if qual["fit_score"] < FIT_THRESHOLD:
            print(f"  Fit score {qual['fit_score']} — below threshold, skipping.")
            continue

        people = search_people(org.get("organisationId"), [qual["target_title"]])
        contact = people[0] if people else {}
        if not contact:
            print(f"  Fit {qual['fit_score']} — no decision-maker found via Clodura, skipping.")
            continue

        contact_name = contact.get("fullName") or f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip()
        if (name, contact_name) in already_contacted:
            print(f"  Already contacted {contact_name} at {name} — skipping.")
            continue

        outreach = draft_outreach(org, contact, qual["signal_summary"])

        rows.append({
            "company": name,
            "domain": org.get("domain", ""),
            "location": f"{org.get('organisationCity') or ''}, {org.get('organisationCountry') or ''}".strip(", "),
            "fit_score": qual["fit_score"],
            "urgency_score": qual["urgency_score"],
            "signal": qual["signal_summary"],
            "target_title": qual["target_title"],
            "contact_name": contact_name,
            "contact_title": contact.get("position", ""),
            "contact_email": contact.get("email") or "",  # or reveal in Clodura UI and paste in
            "contact_linkedin": contact.get("linkedinUrl", ""),
            "linkedin_note": outreach.get("linkedin_note", ""),
            "email_subject": outreach.get("email_subject", ""),
            "email_body": outreach.get("email_body", ""),
            "approved": "",
            "status": "",
            "sent_at": "",
        })
        time.sleep(0.5)

    if not rows:
        print("\nNo qualified leads this run. Try lowering FIT_THRESHOLD or widening HIRING_AREAS.")
        return

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    rows.sort(key=lambda r: -r["fit_score"])
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone. {len(rows)} qualified leads written to {OUTPUT_PATH}")
    print("Next: reveal emails for the ones you like in the Clodura UI, paste into contact_email,")
    print('mark approved="yes", then run: python3 bizquad_leadgen.py send')


# ---------------------------------------------------------------------------
# Send
# ---------------------------------------------------------------------------

def cmd_send():
    if not os.path.exists(OUTPUT_PATH):
        raise SystemExit(f"No leads file found at {OUTPUT_PATH}. Run 'discover' first.")

    with open(OUTPUT_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    to_send = [r for r in rows if r.get("approved", "").strip().lower() == "yes"
               and r.get("status", "").strip().lower() != "sent"]

    if not to_send:
        print("No rows marked approved='yes' and unsent. Nothing to do.")
        return

    missing_email = [r["company"] for r in to_send if not r.get("contact_email", "").strip()]
    if missing_email:
        print(f"Skipping {len(missing_email)} approved rows with no contact_email filled in:")
        for c in missing_email:
            print(f"  - {c}")
        to_send = [r for r in to_send if r.get("contact_email", "").strip()]

    if len(to_send) > 70:
        print(f"{len(to_send)} approved — capping this run at 70 to stay in a safe daily sending range.")
        to_send = to_send[:70]

    print(f"Sending {len(to_send)} emails via Outlook, ~{SEND_DELAY_SECONDS}s apart...")
    token = get_graph_token()
    sent, failed = 0, 0

    for r in to_send:
        try:
            send_via_graph(token, r["contact_email"], r["email_subject"], r["email_body"])
            r["status"] = "sent"
            r["sent_at"] = datetime.now().isoformat(timespec="seconds")
            sent += 1
            print(f"  Sent -> {r['company']} ({r['contact_email']})")
        except requests.HTTPError as e:
            r["status"] = f"failed: {e.response.status_code if e.response is not None else 'error'}"
            failed += 1
            print(f"  FAILED -> {r['company']}: {e}")
        time.sleep(SEND_DELAY_SECONDS)

    # write status back into the same CSV so re-runs don't double-send
    by_key = {(r["company"], r.get("contact_email", "")): r for r in to_send}
    for row in rows:
        key = (row["company"], row.get("contact_email", ""))
        if key in by_key:
            row.update(by_key[key])

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    sent_rows = [r for r in to_send if r.get("status") == "sent"]
    if sent_rows:
        append_sent_log(sent_rows)

    print(f"\nDone. {sent} sent, {failed} failed. Status logged back into {OUTPUT_PATH}")


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "discover"
    if cmd == "discover":
        try:
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_COMPANIES_TO_PROCESS
        except ValueError:
            raise SystemExit("Usage: python3 bizquad_leadgen.py discover [number]")
        cmd_discover(limit=limit)
    elif cmd == "send":
        cmd_send()
    else:
        print("Usage: python3 bizquad_leadgen.py discover [number]")
        print("       python3 bizquad_leadgen.py send")
