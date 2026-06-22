export type CredentialProvider =
  | 'google'
  | 'microsoft'
  | 'dropbox'
  | 'pec'
  | 'internal'

export type CredentialScope =
  | 'calendar_events'
  | 'gmail_send'
  | 'gmail_read'
  | 'drive_files'
  | 'contacts'
  | 'maps'
  | 'notifications'

export type CredentialStatus =
  | 'not_connected'
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'error'

export type ExternalCredential = {
  id: string
  provider: CredentialProvider
  scopes: CredentialScope[]
  status: CredentialStatus
  externalAccountId?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export type CredentialTokenSet = {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresAt?: string
  grantedScopes: CredentialScope[]
}

export type CredentialSaveRequest = {
  provider: CredentialProvider
  scopes: CredentialScope[]
  tokenSet: CredentialTokenSet
  externalAccountId?: string
}

export type CredentialReadResult =
  | {
      success: true
      credential: ExternalCredential
      tokenSet: CredentialTokenSet
    }
  | {
      success: false
      error: string
    }
