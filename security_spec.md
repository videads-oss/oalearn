# Firestore Security Rules Specification

## 1. Data Invariants
1. **Admin Authorization**: Only registered administrators can create, update, or delete PDF records. The default bootstrapped administrator has the email `videads@gmail.com`.
2. **Read-Only Public Access**: Unauthenticated and standard authenticated users have read-only access to `/pdfs/{pdfId}`. They cannot write, edit, or delete any PDF documents.
3. **Valid Identifiers**: Standard identifiers and document IDs must be valid alphanumeric characters (no resource-exhausting characters or path-traversal style characters).
4. **Strict Schema Constraints**: Newly created PDF document listing entries must contain all required fields with sizes strictly bounded to prevent DoS or Denial of Wallet attacks.

---

## 2. The "Dirty Dozen" Scenario Payloads

The following malicious operations must be rejected by the security rules:

1. **Scenario 1 (Anonymous Create)**: Unauthenticated visitor attempts to create a PDF document under `/pdfs/malicious_entry`.
   * **Result**: `PERMISSION_DENIED`
2. **Scenario 2 (Standard User Create)**: Logged-in user who is not an administrator attempts to create a PDF.
   * **Result**: `PERMISSION_DENIED`
3. **Scenario 3 (Email Spoofing Admin Access)**: A user authenticates with an email address matching `videads@gmail.com` but with `email_verified` as `false`. They attempt to create or edit a PDF document.
   * **Result**: `PERMISSION_DENIED`
4. **Scenario 4 (Unbounded String Injection)**: Admin attempts to write a PDF document description that exceeds `10000` characters.
   * **Result**: `PERMISSION_DENIED`
5. **Scenario 5 (Admin Self-Promotion)**: Non-admin user attempts to insert themselves into `/admins/{myUid}`.
   * **Result**: `PERMISSION_DENIED`
6. **Scenario 6 (Immortality Violation)**: Admin attempts to update/alter the `id` or `createdBy` field on a PDF document after creation.
   * **Result**: `PERMISSION_DENIED`
7. **Scenario 7 (Poison ID)**: Admin attempts to create a PDF with a 2KB junk character string as a document ID.
   * **Result**: `PERMISSION_DENIED`
8. **Scenario 8 (Temporal Integrity Violation)**: Admin attempts to create a PDF where `createdAt` is a custom backdated or frontdated timestamp instead of `request.time`.
   * **Result**: `PERMISSION_DENIED`
9. **Scenario 9 (Blanket Read Bypass)**: Hacker tries to execute a blanket query reading all user profiles or system data.
   * **Result**: `PERMISSION_DENIED`
10. **Scenario 10 (Null-State Shortcutting)**: Malicious actor attempts to delete an arbitrary PDF document.
    * **Result**: `PERMISSION_DENIED`
11. **Scenario 11 (Private Admin Read)**: Standard authenticated user tries to list or read document contents in `admins` collection.
    * **Result**: `PERMISSION_DENIED`
12. **Scenario 12 (Ghost Field Injection)**: Admin attempts to create a PDF document that contains unsupported hidden fields (e.g. `isScamVerified: true` or custom fields) bypassing structure.
    * **Result**: `PERMISSION_DENIED`

---

## 3. Test Runner Design

While we are running in an applet environment without a full visual terminal emulator, we ensure these cases are structurally validated by our standard security checks and we define a local test mock suite in our codebase to protect the invariants programmatically.
