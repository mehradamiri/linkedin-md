# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability.

Instead, report it privately through GitHub's
[private vulnerability reporting](https://github.com/mehradamiri/linkedin-md/security/advisories/new).

Expect an acknowledgement within a few days. If the report is valid, we'll agree on a disclosure
timeline with you and credit you in the release notes unless you'd rather stay anonymous.

## Scope

This is a client-side browser extension with no backend, so the interesting surface is small:

- Anything that causes profile data to leave the user's machine.
- Code injection through scraped page content (the page is untrusted input — profile text is
  attacker-controlled and must never be evaluated or inserted as HTML).
- Privilege escalation beyond the declared `activeTab` + `scripting` permissions.
- Supply-chain issues in the build or release pipeline.

## Supported versions

Only the latest release is supported.
