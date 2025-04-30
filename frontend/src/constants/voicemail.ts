// Message box names
export const MESSAGE_BOX = 'p2p voicemail rebuild new messagebox'
export const CONTACTS_BASKET = 'p2p voicemail contacts'
export const INTERNALIZE_BASKET = 'internalize to new basket'
export const SENT_BASKET = 'p2p voicemail rebuild sent'
export const ARCHIVED_BASKET = 'p2p voicemail rebuild archived'
export const SELF_SENT_BASKET = 'p2p voicemail to self'
export const TODO_LIST_BASKET = 'voicemail todo list'

// Protocol IDs
export const PROTOCOL_ID = [0, 'p2p voicemail rebuild']
export const CONTACTS_PROTOCOL_ID = [0, 'p2p voicemail contacts']

// Key IDs
export const KEY_ID = '1'

// Default values
export const DEFAULT_SATOSHIS = 1
export const MAX_SATOSHIS = 100000
export const MIN_SATOSHIS = 1

// Recording constants
export const RECORDING_MIME_TYPE = 'audio/wav'

// UI constants
export const TAB_LABELS = {
  CREATE: 'Create Voicemail',
  CONTACTS: 'Contacts',
  INBOX: 'Inbox'
}

export const STEP_LABELS = {
  RECIPIENT: 'Search For Recipient',
  RECORD: 'Record Voicemail',
  MESSAGE: 'Add A Text Message (Optional)',
  SATOSHIS: 'Attach Satoshis (1 Satoshi Minimum)'
}

// Dialog titles
export const DIALOG_TITLES = {
  CONFIRM_SEND: 'Confirm Send Voicemail',
  TRANSACTION: 'Transaction Confirmation',
  REDEMPTION: 'Redeem Satoshis & Forget Voicemail',
  FORGET_CONTACT: 'Forget Contact'
}

// Status messages
export const STATUS_MESSAGES = {
  SENDING: 'Sending voicemail...',
  REDEEMING: 'Redeeming satoshis and forgetting voicemail...',
  LOADING: 'Loading...'
} 