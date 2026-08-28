namespace PasswordVault.Domain.Enums;

public enum AuditEventType
{
    RegistrationCompleted = 0,
    EmailVerified = 1,
    LoginSucceeded = 2,
    LoginFailed = 3,
    Logout = 4,
    LogoutAllSessions = 5,
    MasterPasswordChanged = 6,
    VaultItemCreated = 7,
    VaultItemUpdated = 8,
    VaultItemDeleted = 9,
    VaultItemRestored = 10,
    FolderCreated = 11,
    FolderRenamed = 12,
    FolderDeleted = 13,
    AccountLocked = 14
}
