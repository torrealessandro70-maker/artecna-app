import type {
  CredentialProvider,
  CredentialReadResult,
  CredentialSaveRequest,
} from './types'

const CREDENTIALS_ENGINE_NOT_CONNECTED =
  'Credentials Engine non ancora collegato a persistenza sicura'

const notConnectedResult = (): CredentialReadResult => ({
  success: false,
  error: CREDENTIALS_ENGINE_NOT_CONNECTED,
})

export function saveCredential(
  request: CredentialSaveRequest
): Promise<CredentialReadResult> {
  void request
  return Promise.resolve(notConnectedResult())
}

export function readCredential(
  provider: CredentialProvider
): Promise<CredentialReadResult> {
  void provider
  return Promise.resolve(notConnectedResult())
}

export function revokeCredential(
  provider: CredentialProvider
): Promise<CredentialReadResult> {
  void provider
  return Promise.resolve(notConnectedResult())
}

export type * from './types'
