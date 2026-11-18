// Out-of-business customers are archived, never deleted (Benjy 11/18). Archived
// = isActive false: gone from every picker, history kept, and anyone trying to
// add them again is told they're archived.
export const ARCHIVE_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];
