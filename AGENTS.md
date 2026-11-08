# executor instructions

- This is a standalone repository; it must never depend on parent/sibling source or configuration.
- Use npm only and commit this repository's own `package-lock.json` when application code begins.
- Do not add application code until Phase 1 exit criteria pass and Phase 2 is explicitly started.
- Provider endpoints/responses are hostile; enforce egress, timeout, byte and redaction limits.
- Resolve only the scoped `SecretRef` needed for one execution and never log it.
