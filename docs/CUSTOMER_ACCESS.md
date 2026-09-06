# Customer account requests and email

## Using the workflow

1. A customer opens /portal/request-access and submits their name, company, and work email. No quotation ID is required.
2. An administrator opens Administration → Customer Requests (/settings/customer-requests). A new in-app notification also links to this queue.
3. The administrator selects an existing customer account or a tier for a new account, then approves. A decline requires a reason.
4. Approval generates a cryptographically random 24-character password and stores an Argon2id hash on the existing User record. Nodemailer emails the login URL, email address, and password to the applicant. Customer access activates after SMTP accepts that email. Declines email the reason.
5. The customer signs in at /portal/login. Account Security (/portal/account) lets them replace the emailed password. Changing it revokes other portal sessions, internal sessions, and unused magic links.

## SMTP settings

Set these in apps/api/.env and restart the API:

```dotenv
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-google-app-password
```

The defaults are smtp.gmail.com on port 465. For Gmail, use a Google app password rather than the normal account password. Optional overrides are SMTP_HOST, SMTP_PORT, and SMTP_FROM. Port 465 uses TLS immediately; other ports require STARTTLS. Certificate verification remains enabled. No email provider credentials are included in source control.

Approval/rejection emails never use the local demo-link shortcut. Without working SMTP credentials, the decision is saved with a failed email status and new password access remains disabled. The administrator can fix configuration and click Retry Email on the Approved or Declined tab. Approval retries generate a new password and replace its hash; plaintext passwords are never stored in audit metadata, notifications, or API responses. SMTP acceptance means the receiving mail server accepted the message, not guaranteed inbox placement.

For multiple organizations, administrators copy their organization-specific registration link from the queue. PORTAL_ORGANIZATION_SLUG chooses the default organization for a public request URL without a parameter. The local demo is configured as dealflow360-demo. Applicants do not type organization IDs or quotation IDs.

## Storage and verification

This feature uses existing User, RoleAssignment, AuditEvent, CustomerAccount, CustomerContact, PortalIdentity, PortalSession, and Notification records. No tables or migrations were added. Pending applicants are invited customer identities with no active role. Reviews require configuration.manage, tenant-scoped records, CSRF protection, and a current revision. The request audit record retains request/delivery state; separate decision audit events retain reviewer identity and reason.

The integration suite uses a local SMTP server with Nodemailer and cleans up its own organization afterward. It checks duplicate submissions, administrator notification, real SMTP credential delivery, hash verification, customer-only sessions, password change, decline, SMTP failure/retry, and concurrent reviewers. It never sends test email through a real provider.
