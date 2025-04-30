import { Identity } from '@bsv/identity-react'

// Voicemail item interface
export interface VoicemailItem {
  id: string
  sender: string
  recipient?: string
  timestamp: number
  audioUrl: string
  message?: string
  satoshis: number
  lockingScript: string
  redemptionTime?: number
  senderName?: string
  metadata?: {
    creationTime?: number
  }
}

// Sort options
export type SortField = 'time' | 'satoshis'
export type SortOrder = 'asc' | 'desc'

// Redemption status
export interface RedemptionStatus {
  status: 'pending' | 'success' | 'error'
  message: string
  txid?: string
}

// Transaction status
export interface TransactionStatus {
  status: 'pending' | 'success' | 'error'
  message: string
  txid?: string
}

// Notification state
export interface NotificationState {
  open: boolean
  message: string
  type: 'success' | 'error' | 'info'
  title: string
  link?: string
}

// Interfaces used, it is necessary to declare them here
// export interface Task {
//   task: string
//   sats: number
//   outpoint: string
//   lockingScript: string
//   beef: BEEF | undefined
// }

// Contact type
export interface Contact {
  name: string;
  identityKey: string;
  txid: string;
  timestamp: number;
}

// Debug info
export interface DebugInfo {
  id: string
  sender: string
  timestamp: string
  satoshis: number
  lockingScript: string
  message: string
}

export interface Voicemail {
  id: string;
  from: string;
  timestamp: Date;
  duration: number;
  isRead: boolean;
  audioUrl: string;
}

export interface VoicemailHeaderProps {
  title: string;
  description: string;
}

export interface VoicemailListProps {
  voicemails: Voicemail[];
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface VoicemailPlayerProps {
  audioUrl: string;
  onEnded?: () => void;
} 