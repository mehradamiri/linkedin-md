# Chrome Web Store listing — LinkedIn → Markdown

Copy-paste these into the Developer Console when creating the item.
Upload package: **linkedin-md.zip** (in the project root).

---

## Product details

**Item name**
LinkedIn to Markdown

**Summary** (max 132 chars)
Turn a LinkedIn profile into clean Markdown. Copy it or download it as a .md file. Local-only, no account, no tracking.

**Description**
Turn any LinkedIn profile into clean, LLM-friendly Markdown — then copy it or download it as a .md file.

Pasting a LinkedIn profile into Claude or ChatGPT doesn't work: LinkedIn sits behind a login wall, so chatbots can't fetch a profile URL themselves. This extension solves that. You're already logged in, so it reads the profile in your own browser and gives you Markdown you can paste straight into a chat — for a tailored resume, a cover letter, interview prep, a candidate summary, or your own notes.

It captures the full profile: header, About, experience (including multiple roles under one company), education, skills, languages, and certifications.

Everything happens locally in your browser:
• No server, no backend, no API, no third party — profile content never leaves your machine.
• No analytics, no telemetry, no tracking.
• Nothing is stored — close the popup and the Markdown is gone.
• No remote code — all code ships in the package and is open source (MIT).
• Uses the activeTab permission, so it only reads the profile page you explicitly click it on. It cannot see your feed, messages, or any other site or tab.

Open source: https://github.com/mehradamiri/linkedin-md

**Category**
Productivity

**Language**
English

---

## Privacy tab

**Single purpose description**
This extension converts the LinkedIn profile page the user is currently viewing into Markdown text, which the user can copy to the clipboard or download as a .md file.

**Permission justifications**
- activeTab: Read the content of the LinkedIn profile page the user clicks the extension on, in order to convert it to Markdown. Access is granted per click and revoked afterward.
- scripting: Inject the script that reads that page's content and converts it to Markdown.
- Remote code: No, the extension does not use remote code. All code ships in the package.

**Data usage / disclosures** (check these on the data collection form)
- Does NOT collect or use any user data. Check "I do not sell or transfer user data to third parties", "I do not use or transfer user data for purposes unrelated to my item's single purpose", "I do not use or transfer user data to determine creditworthiness or for lending purposes."
- Leave every data-type checkbox (personal info, location, activity, etc.) UNCHECKED — the extension collects nothing.

**Privacy policy URL**
https://github.com/mehradamiri/linkedin-md/blob/main/PRIVACY.md

---

## Assets you still need to add

Chrome requires at least these before you can submit:

1. **Store icon — 128×128 PNG.** Use `public/icons/icon128.png` from the project (or a 128×128 export of the logo).
2. **At least one screenshot — 1280×800 or 640×400 PNG/JPEG.** Take one of the popup open on a real LinkedIn profile showing the generated Markdown. (This can't be auto-generated — it needs a live, logged-in LinkedIn page.)
3. Optional but recommended: a small promo tile (440×280) and additional screenshots.

## Distribution / visibility
- Visibility: Public (or Unlisted if you want to share by link only first).
- Regions: All regions.
