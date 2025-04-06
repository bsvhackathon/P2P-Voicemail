import React, { useState, useRef, useEffect } from 'react'
import { IdentitySearchField, Identity, IdentityCard } from '@bsv/identity-react'
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  TextField, 
  Slider, 
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Tooltip,
  IconButton,
  ListItemButton,
  Container,
  FormControlLabel,
  Checkbox
} from '@mui/material'
import { WalletClient, Utils, Transaction, PushDrop, LockingScript } from '@bsv/sdk'
import checkForMetaNetClient from '../utils/checkForMetaNetClient'
import NoMncModal from '../components/NoMncModal'
import NotificationModal from '../components/NotificationModal'
import ArchiveIcon from '@mui/icons-material/Archive'
// Remove the DeleteIcon import
// import DeleteIcon from '@mui/icons-material/Delete'

// Initialize wallet client
const walletClient = new WalletClient()

// Custom hook for async effects
const useAsyncEffect = (effect: () => Promise<void | (() => void)>, deps: React.DependencyList) => {
  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | void;

    const runEffect = async () => {
      try {
        cleanup = await effect();
      } catch (error) {
        console.error('Error in async effect:', error);
      }
    };

    runEffect();

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
    };
  }, deps);
};

// Define a type for voicemail items
interface VoicemailItem {
  id: string;
  sender: string;
  recipient?: string; // Add recipient property for sent voicemails
  timestamp: number;
  audioUrl: string;
  message?: string;
  satoshis: number;
  lockingScript: string;
  redemptionTime?: number;
  senderName?: string;
  metadata?: {
    creationTime?: number;
  };
}

// Define sort options
type SortField = 'time' | 'satoshis';
type SortOrder = 'asc' | 'desc';

// Function to shorten transaction IDs
const shortenTxId = (txId: string): string => {
  if (txId.length <= 12) return txId;
  return `${txId.substring(0, 6)}...${txId.substring(txId.length - 6)}`;
};

// Function to get the full transaction ID from an outpoint
const getTxIdFromOutpoint = (outpoint: string): string => {
  return outpoint.split('.')[0];
};

// Function to create a link to whatsonchain.com for a transaction
const createTxLink = (txId: string): string => {
  return `https://whatsonchain.com/tx/${txId}`;
};

// Custom GitHub icon component
const GitHubIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
)

// Add custom DeleteIcon component
const DeleteIcon = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ marginRight: '4px' }}
  >
    <path 
      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" 
      fill="currentColor"
    />
  </svg>
);

const Voicemail: React.FC = () => {
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [satoshiAmount, setSatoshiAmount] = useState<number>(1)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<number>(0)
  const [voicemails, setVoicemails] = useState<VoicemailItem[]>([])
  const [archivedVoicemails, setArchivedVoicemails] = useState<VoicemailItem[]>([])
  const [sentVoicemails, setSentVoicemails] = useState<VoicemailItem[]>([])
  const [isLoadingVoicemails, setIsLoadingVoicemails] = useState<boolean>(false)
  const [isLoadingArchived, setIsLoadingArchived] = useState<boolean>(false)
  const [isLoadingSent, setIsLoadingSent] = useState<boolean>(false)
  const [redeemOpen, setRedeemOpen] = useState<boolean>(false)
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailItem | null>(null)
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false)
  const [isArchiving, setIsArchiving] = useState<boolean>(false)
  const [loadingDots, setLoadingDots] = useState<string>('.')
  const [searchKey, setSearchKey] = useState<number>(0)
  const [isMncMissing, setIsMncMissing] = useState<boolean>(false)
  const [saveCopy, setSaveCopy] = useState<boolean>(false)
  const [forgettingVoicemailId, setForgettingVoicemailId] = useState<string | null>(null)
  
  // Add sorting state
  const [sortField, setSortField] = useState<SortField>('time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const loadingDotsIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Add state for debug dialog
  const [debugOpen, setDebugOpen] = useState<boolean>(false)
  const [debugInfo, setDebugInfo] = useState<{
    id: string;
    sender: string;
    timestamp: string;
    satoshis: number;
    lockingScript: string;
    message: string;
  } | null>(null)

  // Add state for confirmation dialog after the other state declarations
  const [confirmSendOpen, setConfirmSendOpen] = useState<boolean>(false)

  // Add new state for contacts after other state declarations
  const [contacts, setContacts] = useState<(Identity & { txid: string })[]>([])
  const [newContactName, setNewContactName] = useState<string>('')
  const [newContactKey, setNewContactKey] = useState<string>('')
  const [addContactError, setAddContactError] = useState<string>('')
  const [contactSearchKey, setContactSearchKey] = useState<number>(0)

  // Add back the isLoadingContacts state
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false)

  // Add new state for notification
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    title: string;
  }>({
    open: false,
    message: '',
    type: 'info',
    title: 'Info'
  });

  // Add state for forget contact confirmation dialog
  const [forgetContactOpen, setForgetContactOpen] = useState<boolean>(false);
  const [contactToForget, setContactToForget] = useState<Identity & { txid: string } | null>(null);

  // Run a 1s interval for checking if MNC is running
  useAsyncEffect(async () => {
    const intervalId = setInterval(() => {
      checkForMetaNetClient().then(hasMNC => {
        if (hasMNC === 0) {
          setIsMncMissing(true) // Open modal if MNC is not found
        } else {
          setIsMncMissing(false) // Ensure modal is closed if MNC is found
          clearInterval(intervalId)
        }
      }).catch(error => {
        console.error('Error checking for MetaNet Client:', error)
      })
    }, 1000)

    // Return a cleanup function
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Fetch voicemails when the component first loads
  useEffect(() => {
    fetchVoicemails()
    fetchContacts() // Add this line to fetch contacts on load
    fetchSentVoicemails() // Add this line to fetch sent voicemails on load
    fetchArchivedVoicemails() // Add this line to fetch archived voicemails on load
  }, [])
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
    
    // If switching to the inbox tab, refresh the voicemails
    if (newValue === 1) {
      fetchVoicemails()
    }
    // If switching to the sent tab, refresh the sent voicemails
    else if (newValue === 2) {
      fetchSentVoicemails()
    }
    // If switching to the archived tab, refresh the archived voicemails
    else if (newValue === 3) {
      fetchArchivedVoicemails()
    }
    // If switching to the contacts tab, refresh the contacts
    else if (newValue === 4) {
      fetchContacts()
    }
  }

  // Fetch voicemails from the user's basket
  const fetchVoicemails = async () => {
    setIsLoadingVoicemails(true)
    try {
      const voicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail',
        include: 'entire transactions'
      })
      
      // Decrypt each voicemail
      const decryptedVoicemails = await Promise.all(
        voicemailsFromBasket.outputs.map(async (voicemail: any, i: number) => {
          try {
            const txid = voicemail.outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(voicemailsFromBasket.BEEF as number[], txid)
            const lockingScript = tx!.outputs[0].lockingScript
            
            // Decode the PushDrop data
            const decodedVoicemail = PushDrop.decode(lockingScript)
            const encryptedAudio = decodedVoicemail.fields[1]
            
            // Check if timestamp field exists (field index 2)
            let timestamp = Date.now() // Default to current time if no timestamp
            if (decodedVoicemail.fields.length > 2) {
              try {
                const encryptedTimestamp = decodedVoicemail.fields[2]
                const decryptedTimestampData = await walletClient.decrypt({
                  ciphertext: encryptedTimestamp,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                timestamp = parseInt(Utils.toUTF8(decryptedTimestampData.plaintext), 10)
              } catch (timestampError) {
                console.warn('Error decrypting timestamp, using current time:', timestampError)
                // Continue with default timestamp
              }
            }
            
            // Check if message field exists (field index 3)
            let decryptedMessage = ''
            if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
              try {
                const encryptedMessage = decodedVoicemail.fields[3]
                const decryptedMessageData = await walletClient.decrypt({
                  ciphertext: encryptedMessage,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext)
              } catch (messageError) {
                console.warn('Error decrypting message:', messageError)
                // Continue with empty message
              }
            }
            
            // Decrypt the audio data
            const decryptedAudioData = await walletClient.decrypt({
              ciphertext: encryptedAudio,
              protocolID: [0, 'p2p voicemail'],
              keyID: '1'
            })
            
            // Convert to audio format - fix the Blob creation
            const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' })
            const audioUrl = URL.createObjectURL(audioBlob)
            
            // Get sender information from the transaction
            // This is a simplified example - you might need to extract this differently
            const sender = decodedVoicemail.fields[0] ? Utils.toUTF8(decodedVoicemail.fields[0]) : 'Unknown'
            
            return {
              id: voicemail.outpoint,
              sender,
              timestamp, // Use the decrypted timestamp or default
              audioUrl,
              message: decryptedMessage,
              satoshis: voicemail.satoshis || 0,
              lockingScript: lockingScript.toHex(), // Convert LockingScript to string
              metadata: {
                creationTime: timestamp
              }
            } as VoicemailItem
          } catch (error) {
            console.error('Error decrypting voicemail:', error)
            return null
          }
        })
      )
      
      // Filter out any null results and update state
      const validVoicemails = decryptedVoicemails.filter(
        (voicemail): voicemail is VoicemailItem => voicemail !== null
      )
      
      // Sort the voicemails based on current sort settings
      const sortedVoicemails = sortVoicemails(validVoicemails, sortField, sortOrder)
      
      setVoicemails(sortedVoicemails)
    } catch (error) {
      console.error('Error fetching voicemails:', error)
    } finally {
      setIsLoadingVoicemails(false)
    }
  }
  
  // Function to sort voicemails based on field and order
  const sortVoicemails = (voicemails: VoicemailItem[], field: SortField, order: SortOrder): VoicemailItem[] => {
    return [...voicemails].sort((a, b) => {
      if (field === 'time') {
        return order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
      } else { // satoshis
        return order === 'desc' ? b.satoshis - a.satoshis : a.satoshis - b.satoshis
      }
    })
  }
  
  // Handle sort field change
  const handleSortFieldChange = (event: SelectChangeEvent<SortField>) => {
    const newField = event.target.value as SortField
    setSortField(newField)
    // Re-sort the voicemails with the new field
    setVoicemails(sortVoicemails(voicemails, newField, sortOrder))
  }
  
  // Handle sort order change
  const handleSortOrderChange = (event: SelectChangeEvent<SortOrder>) => {
    const newOrder = event.target.value as SortOrder
    setSortOrder(newOrder)
    // Re-sort the voicemails with the new order
    setVoicemails(sortVoicemails(voicemails, sortField, newOrder))
  }
  
  // Debug function to log voicemail details
  const debugVoicemail = (voicemail: VoicemailItem) => {
    console.log('Voicemail Debug Info:')
    console.log('ID:', voicemail.id)
    console.log('Sender:', voicemail.sender)
    console.log('Timestamp:', new Date(voicemail.timestamp).toLocaleString())
    console.log('Satoshis:', voicemail.satoshis)
    console.log('Locking Script:', voicemail.lockingScript)
    console.log('Message:', voicemail.message || 'No message')
    
    // Show a dialog with the debug info
    setDebugInfo({
      id: voicemail.id,
      sender: voicemail.sender,
      timestamp: new Date(voicemail.timestamp).toLocaleString(),
      satoshis: voicemail.satoshis,
      lockingScript: voicemail.lockingScript,
      message: voicemail.message || 'No message'
    })
    setDebugOpen(true)
  }
  
  // Fetch archived voicemails (spent transactions)
  const fetchArchivedVoicemails = async () => {
    setIsLoadingArchived(true)
    try {
      const archivedVoicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail archived',
        include: 'entire transactions'
      })
      
      // Decrypt each archived voicemail
      const decryptedArchivedVoicemails = await Promise.all(
        archivedVoicemailsFromBasket.outputs.map(async (voicemail: any, i: number) => {
          try {
            const txid = voicemail.outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(archivedVoicemailsFromBasket.BEEF as number[], txid)
            const lockingScript = tx!.outputs[0].lockingScript
            
            // Decode the PushDrop data
            const decodedVoicemail = PushDrop.decode(lockingScript)
            const encryptedAudio = decodedVoicemail.fields[1]
            
            // Check if timestamp field exists (field index 2)
            let timestamp = Date.now() // Default to current time if no timestamp
            if (decodedVoicemail.fields.length > 2) {
              try {
                const encryptedTimestamp = decodedVoicemail.fields[2]
                const decryptedTimestampData = await walletClient.decrypt({
                  ciphertext: encryptedTimestamp,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                timestamp = parseInt(Utils.toUTF8(decryptedTimestampData.plaintext), 10)
              } catch (timestampError) {
                console.warn('Error decrypting timestamp, using current time:', timestampError)
                // Continue with default timestamp
              }
            }
            
            // Check if message field exists (field index 3)
            let decryptedMessage = ''
            if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
              try {
                const encryptedMessage = decodedVoicemail.fields[3]
                const decryptedMessageData = await walletClient.decrypt({
                  ciphertext: encryptedMessage,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext)
              } catch (messageError) {
                console.warn('Error decrypting message:', messageError)
                // Continue with empty message
              }
            }
            
            // Decrypt the audio data
            const decryptedAudioData = await walletClient.decrypt({
              ciphertext: encryptedAudio,
              protocolID: [0, 'p2p voicemail'],
              keyID: '1'
            })
            
            // Convert to audio format
            const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' })
            const audioUrl = URL.createObjectURL(audioBlob)
            
            // Get sender information from the transaction
            const sender = decodedVoicemail.fields[0] ? Utils.toUTF8(decodedVoicemail.fields[0]) : 'Unknown'
            
            return {
              id: voicemail.outpoint,
              sender,
              timestamp,
              audioUrl,
              message: decryptedMessage,
              satoshis: voicemail.satoshis || 0,
              lockingScript: lockingScript.toHex()
            } as VoicemailItem
          } catch (error) {
            console.error('Error decrypting archived voicemail:', error)
            return null
          }
        })
      )
      
      // Filter out any null results and update state
      const validArchivedVoicemails = decryptedArchivedVoicemails.filter(
        (voicemail): voicemail is VoicemailItem => voicemail !== null
      )
      
      // Sort by timestamp (newest first)
      validArchivedVoicemails.sort((a, b) => b.timestamp - a.timestamp)
      
      setArchivedVoicemails(validArchivedVoicemails)
    } catch (error) {
      console.error('Error fetching archived voicemails:', error)
    } finally {
      setIsLoadingArchived(false)
    }
  }

  // Fetch sent voicemails
  const fetchSentVoicemails = async () => {
    setIsLoadingSent(true)
    try {
      const sentVoicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail sent items',
        include: 'entire transactions'
      })
      
      // Decrypt each sent voicemail
      const decryptedSentVoicemails = await Promise.all(
        sentVoicemailsFromBasket.outputs.map(async (voicemail: any, i: number) => {
          try {
            const txid = voicemail.outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(sentVoicemailsFromBasket.BEEF as number[], txid)
            const lockingScript = tx!.outputs[0].lockingScript
            
            // Decode the PushDrop data
            const decodedVoicemail = PushDrop.decode(lockingScript)
            const encryptedAudio = decodedVoicemail.fields[1]
            
            // Check if timestamp field exists (field index 2)
            let timestamp = Date.now() // Default to current time if no timestamp
            if (decodedVoicemail.fields.length > 2) {
              try {
                const encryptedTimestamp = decodedVoicemail.fields[2]
                const decryptedTimestampData = await walletClient.decrypt({
                  ciphertext: encryptedTimestamp,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                timestamp = parseInt(Utils.toUTF8(decryptedTimestampData.plaintext), 10)
              } catch (timestampError) {
                console.warn('Error decrypting timestamp, using current time:', timestampError)
                // Continue with default timestamp
              }
            }
            
            // Check if message field exists (field index 3)
            let decryptedMessage = ''
            if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
              try {
                const encryptedMessage = decodedVoicemail.fields[3]
                const decryptedMessageData = await walletClient.decrypt({
                  ciphertext: encryptedMessage,
                  protocolID: [0, 'p2p voicemail'],
                  keyID: '1'
                })
                decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext)
              } catch (messageError) {
                console.warn('Error decrypting message:', messageError)
                // Continue with empty message
              }
            }
            
            // Decrypt the audio data
            const decryptedAudioData = await walletClient.decrypt({
              ciphertext: encryptedAudio,
              protocolID: [0, 'p2p voicemail'],
              keyID: '1'
            })
            
            // Convert to audio format
            const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' })
            const audioUrl = URL.createObjectURL(audioBlob)
            
            // Get recipient information from the transaction
            const recipient = decodedVoicemail.fields[0] ? Utils.toUTF8(decodedVoicemail.fields[0]) : 'Unknown'
            
            return {
              id: voicemail.outpoint,
              sender: 'self', // This is a sent voicemail, so the sender is 'self'
              recipient: recipient, // Store the recipient
              timestamp,
              audioUrl,
              message: decryptedMessage,
              satoshis: voicemail.satoshis || 0,
              lockingScript: lockingScript.toHex(),
              metadata: {
                creationTime: timestamp
              }
            } as VoicemailItem
          } catch (error) {
            console.error('Error decrypting sent voicemail:', error)
            return null
          }
        })
      )
      
      // Filter out any null results and update state
      const validSentVoicemails = decryptedSentVoicemails.filter(
        (voicemail): voicemail is VoicemailItem => voicemail !== null
      )
      
      // Sort by timestamp (newest first)
      validSentVoicemails.sort((a, b) => b.timestamp - a.timestamp)
      
      setSentVoicemails(validSentVoicemails)
    } catch (error) {
      console.error('Error fetching sent voicemails:', error)
    } finally {
      setIsLoadingSent(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        const audioUrl = URL.createObjectURL(audioBlob)
        setAudioUrl(audioUrl)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }
  
  const deleteRecording = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
  }
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }
  
  const handleSendVoicemail = async () => {
    if (!selectedIdentity) {
      setNotification({
        open: true,
        message: 'Please select a recipient first',
        type: 'error',
        title: 'Error'
      });
      return;
    }

    if (!audioBlob) {
      setNotification({
        open: true,
        message: 'Please record a voicemail first',
        type: 'error',
        title: 'Error'
      });
      return;
    }

    // Show confirmation dialog instead of sending immediately
    setConfirmSendOpen(true);
  };
  
  // New function to handle the actual sending
  const processSendVoicemail = async () => {
    if (!selectedIdentity || !audioBlob) {
      setConfirmSendOpen(false)
      return
    }

    setIsSending(true)
    setConfirmSendOpen(false)
    
    try {
      // Move all the existing send logic here
      // Convert audio blob to array of numbers for encryption
      const audioArrayBuffer = await audioBlob.arrayBuffer()
      const audioArray = Array.from(new Uint8Array(audioArrayBuffer))
      
      // Create a timestamp for when the voicemail was sent
      const timestamp = Date.now()
      
      // Encrypt the audio data with the recipient's identity key
      const encryptedAudio = await walletClient.encrypt({
        plaintext: audioArray,
        protocolID: [0, 'p2p voicemail'],
        keyID: '1',
        counterparty: selectedIdentity.identityKey
      })
      
      // Encrypt the message if provided
      let encryptedMessage: number[] | undefined = undefined
      if (message.trim()) {
        const encryptedMessageData = await walletClient.encrypt({
          plaintext: Utils.toArray(message, 'utf8'),
          protocolID: [0, 'p2p voicemail'],
          keyID: '1',
          counterparty: selectedIdentity.identityKey
        })
        encryptedMessage = encryptedMessageData.ciphertext
      }
      
      // Encrypt the timestamp
      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
        protocolID: [0, 'p2p voicemail'],
        keyID: '1',
        counterparty: selectedIdentity.identityKey
      })
      
      // Create a PushDrop transaction with the encrypted voicemail
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(selectedIdentity.identityKey, 'utf8'), // Recipient's identity key
          encryptedAudio.ciphertext, // Encrypted audio data
          encryptedTimestamp.ciphertext, // Encrypted timestamp
          ...(encryptedMessage ? [encryptedMessage] : []) // Add encrypted message if it exists
        ],
        [0, 'p2p voicemail'],
        '1',
        selectedIdentity.identityKey  // Use recipient's key instead of 'self'
      )
      
      // Create the outputs array with the main voicemail output
      const outputs = [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: satoshiAmount,
        basket: 'p2p voicemail',
          outputDescription: `Voicemail to ${selectedIdentity.name}`
      }]
      
      // If save copy is checked, create another output with the same voicemail encrypted to self
      if (saveCopy) {
        // Encrypt the audio data with the sender's own key
        const selfEncryptedAudio = await walletClient.encrypt({
          plaintext: audioArray,
          protocolID: [0, 'p2p voicemail'],
          keyID: '1',
          counterparty: 'self'
        })
        
        // Encrypt the message if provided
        let selfEncryptedMessage: number[] | undefined = undefined
        if (message.trim()) {
          const selfEncryptedMessageData = await walletClient.encrypt({
            plaintext: Utils.toArray(message, 'utf8'),
            protocolID: [0, 'p2p voicemail'],
            keyID: '1',
            counterparty: 'self'
          })
          selfEncryptedMessage = selfEncryptedMessageData.ciphertext
        }
        
        // Encrypt the timestamp
        const selfEncryptedTimestamp = await walletClient.encrypt({
          plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
          protocolID: [0, 'p2p voicemail'],
          keyID: '1',
          counterparty: 'self'
        })
        
        // Create a PushDrop transaction with the encrypted voicemail for self
        const selfBitcoinOutputScript = await pushdrop.lock(
          [
            Utils.toArray(selectedIdentity.identityKey, 'utf8'), // Recipient's identity key
            selfEncryptedAudio.ciphertext, // Encrypted audio data
            selfEncryptedTimestamp.ciphertext, // Encrypted timestamp
            ...(selfEncryptedMessage ? [selfEncryptedMessage] : []) // Add encrypted message if it exists
          ],
          [0, 'p2p voicemail'],
          '1',
          'self'  // Use self key
        )
        
        // Add the self-encrypted output to the outputs array
        outputs.push({
          lockingScript: selfBitcoinOutputScript.toHex(),
          satoshis: 1, // Use 1 satoshi for the copy
          basket: 'p2p voicemail sent items',
          outputDescription: `Copy of voicemail to ${selectedIdentity.name}`
        })
      }
      
      // Create the transaction with the encrypted voicemail
      const voicemailTransaction = await walletClient.createAction({
        outputs: outputs,
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Send voicemail to ${selectedIdentity.name}`
      })
      
      console.log('Voicemail sent successfully:', voicemailTransaction.txid)
      
      // Reset form after successful send
      setSelectedIdentity(null)
      setAudioBlob(null)
      setAudioUrl(null)
      setRecordingTime(0)
      setMessage('')
      setSatoshiAmount(1)
      setSaveCopy(false)
      
      // Refresh the inbox to update the count
      fetchVoicemails()
      
      // If we saved a copy, refresh the sent voicemails
      if (saveCopy) {
        fetchSentVoicemails()
      }
      
      // Use NotificationModal instead of alert
      setNotification({
        open: true,
        message: 'Voicemail sent successfully!',
        type: 'success',
        title: 'Success'
      });
      
    } catch (error) {
      console.error('Error sending voicemail:', error)
      // Use NotificationModal instead of alert
      setNotification({
        open: true,
        message: 'Failed to send voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsSending(false)
    }
  }

  // Handle redeeming satoshis from a voicemail
  const handleRedeemSatoshis = async (voicemail: VoicemailItem) => {
    setSelectedVoicemail(voicemail)
    setRedeemOpen(true)
  }
  
  // Process the redemption of satoshis
  const processRedemption = async (archive: boolean = false) => {
    if (!selectedVoicemail) return
    
    if (archive) {
      setIsArchiving(true)
    } else {
      setIsRedeeming(true)
    }
    
    try {
      // Get the transaction ID from the voicemail ID
      const txid = selectedVoicemail.id.split('.')[0]
      
      // Fetch the BEEF data for the transaction
      const voicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail',
        include: 'entire transactions'
      })
      
      // Create a description for the redemption
      let description = `Redeem satoshis from voicemail from ${selectedVoicemail.sender}`
      if (description.length > 128) { 
        description = description.substring(0, 128) 
      }
      
      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: voicemailsFromBasket.BEEF as number[],
        inputs: [{
          inputDescription: 'Redeem voicemail satoshis',
          outpoint: selectedVoicemail.id,
          unlockingScriptLength: 73
        }],
        outputs: archive ? [{
          lockingScript: LockingScript.fromHex(selectedVoicemail?.lockingScript || '').toHex(),
          satoshis: 1, // Use 1 satoshi for the archived copy
          basket: 'p2p voicemail archived',
          outputDescription: `Archived voicemail from ${selectedVoicemail?.sender || 'unknown'}`
        }] : [],
        options: {
          randomizeOutputs: false
        }
      })
      
      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)
      
      // Unlock the PushDrop token
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'p2p voicemail'],
        '1',
        'self',
        'all',
        false,
        selectedVoicemail.satoshis,
        LockingScript.fromHex(selectedVoicemail.lockingScript)
      )
      
      const unlockingScript = await unlocker.sign(partialTx, 0)
      
      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      
      console.log('Satoshis redeemed successfully:', signResult)
      
      // Remove the redeemed voicemail from the list
      setVoicemails(voicemails.filter(v => v.id !== selectedVoicemail.id))
      
      // If we archived the voicemail, refresh the archived voicemails list
      if (archive) {
        fetchArchivedVoicemails()
      }

      // Check if there's a copy in the sent folder and remove it
      const sentVoicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail sent items',
        include: 'entire transactions'
      })

      // Find the matching sent voicemail by comparing the locking scripts
      const sentVoicemail = sentVoicemailsFromBasket.outputs.find(
        (voicemail: any) => voicemail.outpoint.split('.')[0] === txid
      )

      if (sentVoicemail) {
        // Create a transaction to forget the sent copy
        const { signableTransaction: forgetTx } = await walletClient.createAction({
          description: `Forget sent copy of redeemed voicemail`,
          inputBEEF: sentVoicemailsFromBasket.BEEF as number[],
          inputs: [{
            inputDescription: 'Forget sent voicemail copy',
            outpoint: sentVoicemail.outpoint,
            unlockingScriptLength: 73
          }],
          outputs: [], // No outputs - just redeem the satoshis
          options: {
            randomizeOutputs: false
          }
        })

        if (forgetTx === undefined) {
          throw new Error('Failed to create forget transaction')
        }

        const forgetPartialTx = Transaction.fromBEEF(forgetTx.tx)
        
        // Unlock the PushDrop token for the sent copy
        const forgetUnlocker = new PushDrop(walletClient).unlock(
          [0, 'p2p voicemail'],
          '1',
          'self',
          'all',
          false,
          1, // 1 satoshi for sent copies
          LockingScript.fromHex(sentVoicemail.lockingScript || '')
        )
        
        const forgetUnlockingScript = await forgetUnlocker.sign(forgetPartialTx, 0)
        
        // Sign the forget transaction
        await walletClient.signAction({
          reference: forgetTx.reference,
          spends: {
            0: {
              unlockingScript: forgetUnlockingScript.toHex()
            }
          }
        })

        // Refresh the sent voicemails list
        fetchSentVoicemails()
      }
      
      // Close the dialog
      setRedeemOpen(false)
      setSelectedVoicemail(null)
      
      // Show success notification
      setNotification({
        open: true,
        message: `Successfully redeemed ${selectedVoicemail.satoshis} satoshis${archive ? ' and archived the voicemail' : ''}!`,
        type: 'success',
        title: 'Success'
      });
    } catch (error) {
      console.error('Error redeeming satoshis:', error)
      setNotification({
        open: true,
        message: 'Failed to redeem satoshis. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsRedeeming(false)
      setIsArchiving(false)
    }
  }

  // Function to clear the selected identity and reset the search field
  const clearSelectedIdentity = () => {
    setSelectedIdentity(null);
    // Force the IdentitySearchField to re-render by changing the key
    setSearchKey(prevKey => prevKey + 1);
  };

  // Function to determine if a step is complete
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!selectedIdentity;
      case 2:
        return !!audioBlob;
      case 3:
        return true; // Optional step, always considered complete
      case 4:
        return satoshiAmount > 0;
      default:
        return false;
    }
  };

  // Fix the handleAddContact function to handle Identity type correctly
  const handleAddContact = async () => {
    if (!selectedIdentity) {
      setNotification({
        open: true,
        message: 'Please select an identity first',
        type: 'error',
        title: 'Error'
      });
      return;
    }

    try {
      await processCreateEncryptedContact(selectedIdentity.name, selectedIdentity.identityKey);
      
      setNotification({
        open: true,
        message: 'Contact added successfully!',
        type: 'success',
        title: 'Success'
      });
      setSelectedIdentity(null);
      setSearchKey(Date.now());
      fetchContacts();
    } catch (error) {
      console.error('Error adding contact:', error);
      setNotification({
        open: true,
        message: 'Failed to add contact. Please try again.',
        type: 'error',
        title: 'Error'
      });
    }
  };

  // Fix the PushDrop.create call
  const processCreateEncryptedContact = async (name: string, identityKey: string) => {
    try {
      // Encrypt the contact details
      const encryptedName = await walletClient.encrypt({
        plaintext: Utils.toArray(name, 'utf8'),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      })

      const encryptedIdentityKey = await walletClient.encrypt({
        plaintext: Utils.toArray(identityKey, 'utf8'),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      })

      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Utils.toArray(Date.now().toString(), 'utf8'),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      })

      // Create the transaction using the correct PushDrop API
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          encryptedName.ciphertext,
          encryptedIdentityKey.ciphertext,
          encryptedTimestamp.ciphertext
        ],
        [0, 'p2p voicemail contacts'],
        '1',
        'self'
      )
      
      // Create the transaction
      const tx = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: 1,
          basket: 'p2p voicemail contacts',
          outputDescription: `Contact: ${name}`
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Create encrypted contact: ${name}`
      })

      // Add to local contacts list
      const newContact: Identity & { txid: string } = {
        name,
        identityKey,
        txid: tx.txid || '', // Provide a default empty string if txid is undefined
        avatarURL: '',
        abbreviatedKey: identityKey.substring(0, 8),
        badgeIconURL: '',
        badgeLabel: '',
        badgeClickURL: ''
      }

      setContacts(prevContacts => [...prevContacts, newContact])
    } catch (error) {
      console.error('Error creating encrypted contact:', error)
      throw error
    }
  }

  // Add new function to handle removing contacts
  const handleRemoveContact = (identityKey: string) => {
    setContacts(prevContacts => prevContacts.filter(contact => contact.identityKey !== identityKey) as (Identity & { txid: string })[])
  }

  // Add new function to fetch contacts
  const fetchContacts = async () => {
    setIsLoadingContacts(true)
    try {
      const contactsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail contacts',
        include: 'entire transactions'
      })
      
      // Decrypt each contact
      const decryptedContacts = await Promise.all(
        contactsFromBasket.outputs.map(async (contact: any, i: number) => {
          try {
            const txid = contact.outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(contactsFromBasket.BEEF as number[], txid)
            const lockingScript = tx!.outputs[0].lockingScript
            
            // Decode the PushDrop data
            const decodedContact = PushDrop.decode(lockingScript)
            
            // Decrypt the contact name/description
            const encryptedName = decodedContact.fields[0]
            const decryptedNameData = await walletClient.decrypt({
              ciphertext: encryptedName,
              protocolID: [0, 'p2p voicemail contacts'],
              keyID: '1'
            })
            const contactName = Utils.toUTF8(decryptedNameData.plaintext)
            
            // Decrypt the identity key
            const encryptedIdentityKey = decodedContact.fields[1]
            const decryptedIdentityKeyData = await walletClient.decrypt({
              ciphertext: encryptedIdentityKey,
              protocolID: [0, 'p2p voicemail contacts'],
              keyID: '1'
            })
            const identityKey = Utils.toUTF8(decryptedIdentityKeyData.plaintext)
            
            // Create a contact object
            return {
              name: contactName,
              identityKey: identityKey,
              txid: txid, // Add the transaction ID
              avatarURL: '', // Default empty avatar
              abbreviatedKey: identityKey.substring(0, 8),
              badgeIconURL: '',
              badgeLabel: '',
              badgeClickURL: ''
            } as Identity & { txid: string }
          } catch (error) {
            console.error('Error decrypting contact:', error)
            return null
          }
        })
      )
      
      // Filter out any null results and update state
      const validContacts = decryptedContacts.filter(
        (contact): contact is (Identity & { txid: string }) => contact !== null
      )
      
      setContacts(validContacts)
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setIsLoadingContacts(false)
    }
  }

  // Add new function to handle selecting a contact from the dropdown
  const handleSelectContact = (contact: Identity) => {
    setSelectedIdentity(contact)
  }

  // Update the processForgetContact function to handle the confirmation flow
  const handleForgetContactClick = (contact: Identity & { txid: string }) => {
    setContactToForget(contact);
    setForgetContactOpen(true);
  };

  const processForgetContact = async () => {
    if (!contactToForget) return;
    
    try {
      // Get the transaction ID from the contact
      const txid = contactToForget.txid;
      
      // Fetch the BEEF data for the transaction
      const contactsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail contacts',
        include: 'entire transactions'
      });
      
      // Create a description for the redemption
      let description = `Forget contact ${contactToForget.name}`;
      if (description.length > 128) { 
        description = description.substring(0, 128); 
      }
      
      // Get the transaction data from the contact
      const tx = Transaction.fromBEEF(contactsFromBasket.BEEF as number[], txid);
      const lockingScript = tx!.outputs[0].lockingScript;
      
      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: contactsFromBasket.BEEF as number[],
        inputs: [{
          inputDescription: 'Forget contact',
          outpoint: `${txid}.0`,
          unlockingScriptLength: 73
        }],
        outputs: [], // No outputs - just redeem the satoshis
        options: {
          randomizeOutputs: false
        }
      });
      
      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction');
      }
      
      const partialTx = Transaction.fromBEEF(signableTransaction.tx);
      
      // Unlock the PushDrop token
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'p2p voicemail contacts'],
        '1',
        'self',
        'all',
        false,
        1, // 1 satoshi for contacts
        lockingScript
      );
      
      const unlockingScript = await unlocker.sign(partialTx, 0);
      
      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      });
      
      console.log('Contact forgotten successfully:', signResult);
      
      // Remove the forgotten contact from the list
      setContacts(contacts.filter(c => c.identityKey !== contactToForget.identityKey));
      
      // Show success notification
      setNotification({
        open: true,
        message: `Successfully forgotten contact "${contactToForget.name}" and redeemed satoshis!`,
        type: 'success',
        title: 'Success'
      });
      
      // Force a refresh of contacts
      await fetchContacts();
      
    } catch (error) {
      console.error('Error forgetting contact:', error);
      setNotification({
        open: true,
        message: 'Failed to forget contact. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      // Close the confirmation dialog
      setForgetContactOpen(false);
      setContactToForget(null);
    }
  };

  // Process forgetting an archived voicemail
  const processForgetArchivedVoicemail = async (voicemail: VoicemailItem) => {
    // Set the specific voicemail as being processed
    setForgettingVoicemailId(voicemail.id)
    
    try {
      // Get the transaction ID from the voicemail ID
      const txid = voicemail.id.split('.')[0]
      
      // Fetch the BEEF data for the transaction
      const archivedVoicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail archived',
        include: 'entire transactions'
      })
      
      // Create a description for the redemption
      let description = `Forget archived voicemail from ${voicemail.sender}`
      if (description.length > 128) { 
        description = description.substring(0, 128) 
      }
      
      // Get the transaction data from the archived voicemail
      const tx = Transaction.fromBEEF(archivedVoicemailsFromBasket.BEEF as number[], txid)
      const lockingScript = tx!.outputs[0].lockingScript
      
      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: archivedVoicemailsFromBasket.BEEF as number[],
        inputs: [{
          inputDescription: 'Forget archived voicemail',
          outpoint: voicemail.id,
          unlockingScriptLength: 73
        }],
        outputs: [], // No outputs - just redeem the satoshis
        options: {
          randomizeOutputs: false
        }
      })
      
      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)
      
      // Unlock the PushDrop token
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'p2p voicemail'],
        '1',
        'self',
        'all',
        false,
        voicemail.satoshis,
        lockingScript
      )
      
      const unlockingScript = await unlocker.sign(partialTx, 0)
      
      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      
      console.log('Archived voicemail forgotten successfully:', signResult)
      
      // Remove the forgotten voicemail from the list
      setArchivedVoicemails(archivedVoicemails.filter(v => v.id !== voicemail.id))
      
      // Show success notification
      setNotification({
        open: true,
        message: `Successfully forgotten archived voicemail and redeemed ${voicemail.satoshis} satoshis!`,
        type: 'success',
        title: 'Success'
      })
    } catch (error) {
      console.error('Error forgetting archived voicemail:', error)
      setNotification({
        open: true,
        message: 'Failed to forget archived voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      })
    } finally {
      setForgettingVoicemailId(null)
    }
  }

  // Process forgetting a sent voicemail
  const processForgetSentVoicemail = async (voicemail: VoicemailItem) => {
    // Set the specific voicemail as being processed
    setForgettingVoicemailId(voicemail.id)
    
    try {
      // Get the transaction ID from the voicemail ID
      const txid = voicemail.id.split('.')[0]
      
      // Fetch the BEEF data for the transaction
      const sentVoicemailsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail sent items',
        include: 'entire transactions'
      })
      
      // Create a description for the redemption
      let description = `Forget sent voicemail to ${voicemail.recipient || 'recipient'}`
      if (description.length > 128) { 
        description = description.substring(0, 128) 
      }
      
      // Get the transaction data from the sent voicemail
      const tx = Transaction.fromBEEF(sentVoicemailsFromBasket.BEEF as number[], txid)
      const lockingScript = tx!.outputs[0].lockingScript
      
      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: sentVoicemailsFromBasket.BEEF as number[],
        inputs: [{
          inputDescription: 'Forget sent voicemail',
          outpoint: voicemail.id,
          unlockingScriptLength: 73
        }],
        outputs: [], // No outputs - just redeem the satoshis
        options: {
          randomizeOutputs: false
        }
      })
      
      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)
      
      // Unlock the PushDrop token
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'p2p voicemail'],
        '1',
        'self',
        'all',
        false,
        voicemail.satoshis,
        lockingScript
      )
      
      const unlockingScript = await unlocker.sign(partialTx, 0)
      
      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      
      console.log('Sent voicemail forgotten successfully:', signResult)
      
      // Remove the forgotten voicemail from the list
      setSentVoicemails(sentVoicemails.filter(v => v.id !== voicemail.id))
      
      // Show success notification
      setNotification({
        open: true,
        message: `Successfully forgotten sent voicemail and redeemed ${voicemail.satoshis} satoshis!`,
        type: 'success',
        title: 'Success'
      })
    } catch (error) {
      console.error('Error forgetting sent voicemail:', error)
      setNotification({
        open: true,
        message: 'Failed to forget sent voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      })
    } finally {
      setForgettingVoicemailId(null)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />
    
    {/* Add the confirmation dialog */}
    <Dialog 
      open={confirmSendOpen} 
      onClose={() => setConfirmSendOpen(false)}
      maxWidth="sm"
      fullWidth
    >
        <DialogTitle>Confirm Send Voicemail</DialogTitle>
      <DialogContent>
        <Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>To:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              <Box component="div" sx={{ mb: 1 }}>
                {selectedIdentity?.name}
              </Box>
              <IdentityCard 
                identityKey={selectedIdentity?.identityKey || ''} 
              />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Recording:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              <audio controls src={audioUrl || ''} style={{ width: '100%' }} />
            </Box>
          </Box>

          {message && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Message:</strong>
              </Typography>
              <Box sx={{ ml: 2 }}>
                {message}
              </Box>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Attached Satoshis:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              {satoshiAmount.toLocaleString()} satoshis ({(satoshiAmount / 100000000).toFixed(8)} BSV)
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
          <Button onClick={() => setConfirmSendOpen(false)}>Cancel</Button>
        <Button 
          onClick={processSendVoicemail}
            color="primary"
          variant="contained"
          disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Confirm Send'}
        </Button>
      </DialogActions>
    </Dialog>

    <Box sx={{ 
      maxWidth: '1200px', 
      mx: 'auto', 
      p: { xs: 2, md: 4 },
      background: 'linear-gradient(180deg, rgba(247, 147, 26, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      position: 'relative'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        alignItems: { xs: 'center', md: 'flex-start' }, 
        justifyContent: 'space-between',
        mb: 4,
        pb: 3,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'center', md: 'flex-start' },
          width: '100%'
        }}>
          <Box 
            component="img" 
            src="/web-app-manifest-512x512.png" 
            alt="Bitcoin Voicemail Logo" 
            sx={{ 
              height: { xs: 100, md: 80 },
              width: { xs: 100, md: 80 },
              mb: { xs: 2, md: 0 },
              mr: { xs: 0, md: 2 }
            }} 
          />
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography variant="h4" component="h1" sx={{ 
              fontWeight: 700, 
              color: 'rgba(255, 255, 255, 0.9)',
              mb: 1
            }}>
                P2P Voicemail On Bitcoin
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '600px' }}>
              Send encrypted, peer-to-peer, on-chain voicemail with attached micropayments while utilizing your encrypted contact list.
              </Typography>
              
          </Box>
        </Box>
        <Box sx={{ 
          mt: { xs: 3, md: 0 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'center', md: 'flex-end' },
          width: { xs: '100%', md: 'auto' }
        }}>
          {/* "Only On:" and Bitcoin logo in upper right */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            mb: 2
          }}>
   
            <img 
              src="/bitcoin_logo.svg" 
              alt="Bitcoin Logo" 
              style={{ 
                height: '20px', 
                width: 'auto',
                filter: 'brightness(0.8)'
              }} 
            />
          </Box>
          
          {/* GitHub link */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1
          }}>

            <IconButton
              size="small"
              onClick={() => window.open('https://github.com/bsvhackathon/P2P-Voicemail', '_blank')}
              sx={{ 
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              <GitHubIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="voicemail tabs"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ 
          mb: 3,
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0'
          }
        }}
      >
        <Tab label="Create Voicemail" />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              Inbox
              {isLoadingVoicemails ? (
                <Box 
                  component="span" 
                  sx={{ 
                    ml: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    position: 'relative'
                  }}
                >
                  <Box 
                    component="span" 
                    sx={{ 
                      position: 'absolute',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'text.primary',
                      animation: 'pulse 1.5s infinite ease-in-out',
                      '&:nth-of-type(1)': {
                        left: '0px',
                        animationDelay: '0s'
                      },
                      '&:nth-of-type(2)': {
                        left: '6px',
                        animationDelay: '0.2s'
                      },
                      '&:nth-of-type(3)': {
                        left: '12px',
                        animationDelay: '0.4s'
                      },
                      '@keyframes pulse': {
                        '0%, 100%': {
                          opacity: 0.2,
                          transform: 'scale(0.8)'
                        },
                        '50%': {
                          opacity: 1,
                          transform: 'scale(1.2)'
                        }
                      }
                    }}
                  />
                  <Box 
                    component="span" 
                    sx={{ 
                      position: 'absolute',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'text.primary',
                      animation: 'pulse 1.5s infinite ease-in-out',
                      '&:nth-of-type(1)': {
                        left: '0px',
                        animationDelay: '0s'
                      },
                      '&:nth-of-type(2)': {
                        left: '6px',
                        animationDelay: '0.2s'
                      },
                      '&:nth-of-type(3)': {
                        left: '12px',
                        animationDelay: '0.4s'
                      },
                      '@keyframes pulse': {
                        '0%, 100%': {
                          opacity: 0.2,
                          transform: 'scale(0.8)'
                        },
                        '50%': {
                          opacity: 1,
                          transform: 'scale(1.2)'
                        }
                      }
                    }}
                  />
                  <Box 
                    component="span" 
                    sx={{ 
                      position: 'absolute',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'text.primary',
                      animation: 'pulse 1.5s infinite ease-in-out',
                      '&:nth-of-type(1)': {
                        left: '0px',
                        animationDelay: '0s'
                      },
                      '&:nth-of-type(2)': {
                        left: '6px',
                        animationDelay: '0.2s'
                      },
                      '&:nth-of-type(3)': {
                        left: '12px',
                        animationDelay: '0.4s'
                      },
                      '@keyframes pulse': {
                        '0%, 100%': {
                          opacity: 0.2,
                          transform: 'scale(0.8)'
                        },
                        '50%': {
                          opacity: 1,
                          transform: 'scale(1.2)'
                        }
                      }
                    }}
                  />
                </Box>
              ) : (
                <Box component="span" sx={{ ml: 1 }}>({voicemails.length})</Box>
              )}
            </Box>
          } 
        />
          <Tab 
            label={
          <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            Sent
            {isLoadingSent ? (
              <Box 
                component="span" 
                sx={{ 
                  ml: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  position: 'relative'
                }}
              >
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
              </Box>
            ) : (
              <Box component="span" sx={{ ml: 1 }}>({sentVoicemails.length})</Box>
            )}
          </Box>
            } 
          />
          <Tab 
            label={
          <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            Archived
            {isLoadingArchived ? (
              <Box 
                component="span" 
                sx={{ 
                  ml: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  position: 'relative'
                }}
              >
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
              </Box>
            ) : (
              <Box component="span" sx={{ ml: 1 }}>({archivedVoicemails.length})</Box>
            )}
          </Box>
            } 
          />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            Contacts
            {isLoadingContacts ? (
              <Box 
                component="span" 
                sx={{ 
                  ml: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  position: 'relative'
                }}
              >
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
                <Box 
                  component="span" 
                  sx={{ 
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'text.primary',
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '&:nth-of-type(1)': {
                      left: '0px',
                      animationDelay: '0s'
                    },
                    '&:nth-of-type(2)': {
                      left: '6px',
                      animationDelay: '0.2s'
                    },
                    '&:nth-of-type(3)': {
                      left: '12px',
                      animationDelay: '0.4s'
                    },
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 0.2,
                        transform: 'scale(0.8)'
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'scale(1.2)'
                      }
                    }
                  }}
                />
              </Box>
            ) : (
              <Box component="span" sx={{ ml: 1 }}>({contacts.length})</Box>
            )}
          </Box>
        } />
      </Tabs>
      
      {activeTab === 0 && (
        <>
          <Card sx={{ mb: 4, position: 'relative' }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mt: 2,
              mb: 1
            }}>
              <Box sx={{ 
                width: 100, 
                height: 50, 
                borderRadius: '25px', 
                backgroundColor: isStepComplete(1) ? 'success.main' : 'transparent',
                border: '2px solid',
                borderColor: 'white',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                Step 1
              </Box>
            </Box>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Search For Recipient
                  </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3
                }}>
                  <IdentitySearchField 
                    key={searchKey}
                    onIdentitySelected={(identity) => {
                      setSelectedIdentity(identity)
                    }}
                  />
                </Box>
              </Box>
              <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3
                }}>
                  {/* Search Section */}


                  {/* Contacts Section */}
                  <Box sx={{ width: '100%', maxWidth: 600 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                    ...Or Select From Contacts  {isLoadingContacts ? '' : `(${contacts.length})`}
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 200,
                      bgcolor: 'background.paper'
                    }}
                  >
                    {isLoadingContacts ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                          Loading contacts...
                        </Typography>
                      </Box>
                    ) : contacts.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" align="center">
                        No contacts yet.<br />
                        Add contacts to quickly select recipients.
                      </Typography>
                    ) : (
                      <Box sx={{ width: '100%' }}>
                        <List sx={{ width: '100%', maxHeight: 200, overflow: 'auto' }}>
                          {contacts.map((contact, index) => (
                            <ListItemButton 
                                key={contact.identityKey}
                              onClick={() => handleSelectContact(contact)}
                              sx={{ 
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                mb: 1,
                                bgcolor: 'background.paper'
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography 
                                      component="span" 
                                      sx={{ 
                                        mr: 1, 
                                        fontWeight: 'bold',
                                        color: 'text.secondary',
                                        minWidth: '24px'
                                      }}
                                    >
                                      {index + 1}.
                                    </Typography>
                                    {contact.name}
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ mt: 1 }}>
                                    <IdentityCard identityKey={contact.identityKey} />
                                  </Box>
                                }
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Paper>
                </Box>
              </Box>
              
              {selectedIdentity && (
                <Box sx={{ mt: 2, position: 'relative' }}>
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'background.paper', 
                      position: 'relative',
                        maxWidth: 600, 
                        mx: 'auto',
                        border: '1px solid',
                        borderColor: '#2e7d32',
                        borderRadius: 1
                      }}
                    >
                      <Box sx={{ 
                        position: 'absolute', 
                        top: -12, 
                        left: 16, 
                        bgcolor: '#2e7d32', 
                        color: 'white', 
                        px: 1.5, 
                        py: 0.5, 
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 4C14.21 4 16 5.79 16 8C16 10.21 14.21 12 12 12C9.79 12 8 10.21 8 8C8 5.79 9.79 4 12 4ZM12 14C16.42 14 20 15.79 20 18V20H4V18C4 15.79 7.58 14 12 14Z" fill="white"/>
                        </svg>
                        Recipient
                      </Box>
                    <IconButton 
                      size="small" 
                      onClick={clearSelectedIdentity}
                      sx={{ 
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'error.main'
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </IconButton>
                    <Typography variant="subtitle1">
                      <strong>Name:</strong> {selectedIdentity.name}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <strong>Identity Key:</strong>
                      <IdentityCard 
                        identityKey={selectedIdentity.identityKey} 
                      />
                    </Box>
                  </Paper>
                </Box>
              )}
            </CardContent>
          </Card>
          
          <Card sx={{ mb: 4, position: 'relative' }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mt: 2,
              mb: 1
            }}>
              <Box sx={{ 
                width: 100, 
                height: 50, 
                borderRadius: '25px', 
                backgroundColor: isStepComplete(2) ? 'success.main' : 'transparent',
                border: '2px solid',
                borderColor: 'white',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                Step 2
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h6">
                Record Voicemail
              </Typography>
            </Box>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                {!isRecording && !audioUrl && (
                  <Button 
                    variant="contained" 
                    color="error" 
                    size="large"
                    onClick={startRecording}
                    sx={{ 
                      minWidth: 250,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      border: '2px solid white',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                      '&:hover': {
                        boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <Box 
                      component="span" 
                      sx={{ 
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        display: 'inline-block'
                      }} 
                    />
                    Start Recording
                  </Button>
                )}
                
                {isRecording && (
                  <>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    <Typography variant="body1" sx={{ mr: 2 }}>
                      Recording: {formatTime(recordingTime)}
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="error" 
                      size="large"
                      onClick={stopRecording}
                      sx={{ 
                        minWidth: 200,
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        border: '2px solid white',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        '&:hover': {
                          boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
                          transform: 'translateY(-2px)'
                        },
                        transition: 'all 0.2s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <Box 
                        component="span" 
                        sx={{ 
                          width: 12,
                          height: 12,
                          backgroundColor: 'white',
                          display: 'inline-block'
                        }} 
                      />
                      Stop Recording
                    </Button>
                  </>
                )}
              </Box>
              
              {audioUrl && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Your Recording:
                  </Typography>
                  <audio controls src={audioUrl} style={{ width: '100%', marginBottom: '10px' }} />
                  <Button 
                    variant="outlined" 
                    color="error" 
                    onClick={deleteRecording}
                    size="small"
                  >
                    Delete Recording
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
          
          <Card sx={{ mb: 4, position: 'relative' }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mt: 2,
              mb: 1
            }}>
              <Box sx={{ 
                width: 100, 
                height: 50, 
                borderRadius: '25px', 
                backgroundColor: isStepComplete(3) ? 'success.main' : 'transparent',
                border: '2px solid',
                borderColor: 'white',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                Step 3
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h6">
                Add A Text Message (Optional)
              </Typography>
            </Box>
            <CardContent>
              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder="Add a text message to accompany your voicemail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </CardContent>
          </Card>
          
          <Card sx={{ mb: 4, position: 'relative' }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mt: 2,
              mb: 1
            }}>
              <Box sx={{ 
                width: 100, 
                height: 50, 
                borderRadius: '25px', 
                backgroundColor: isStepComplete(4) ? 'success.main' : 'transparent',
                border: '2px solid',
                borderColor: 'white',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                Step 4
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h6">
                Attach Satoshis (1 Satoshi Minimum)
              </Typography>
            </Box>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Slider
                  value={satoshiAmount}
                  onChange={(_, value) => setSatoshiAmount(value as number)}
                  min={1}
                  max={1000000}
                  step={1000}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value.toLocaleString()} sats`}
                  sx={{ mb: 2 }}
                />
                <TextField
                  type="number"
                  label="Satoshis"
                  value={satoshiAmount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 100000000) {
                      setSatoshiAmount(value);
                    }
                  }}
                  inputProps={{ 
                    min: 1, 
                    max: 100000000,
                    step: 1
                  }}
                  fullWidth
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {satoshiAmount.toLocaleString()} satoshis = {(satoshiAmount / 100000000).toFixed(8)} BSV
              </Typography>
            </CardContent>
          </Card>
          
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={saveCopy}
                    onChange={(e) => setSaveCopy(e.target.checked)}
                    color="primary"
                  />
                }
                label="Save a copy in sent folder"
              />
            <Button
              variant="contained"
                color="success"
              size="large"
              disabled={!selectedIdentity || !audioBlob || isSending}
              onClick={handleSendVoicemail}
              sx={{ 
                  minWidth: 300,
                  py: 2,
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  '&:hover': {
                    boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
                    transform: 'translateY(-2px)',
                    bgcolor: '#2e7d32' // lighter green on hover
                  },
                  transition: 'all 0.2s ease-in-out',
                  border: '2px solid white',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: '#1b5e20' // dark green background
                }}
              >
                {isSending ? 'Sending...' : (
                  <>
                    <svg 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M22 2L11 13" 
                        stroke="white" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <path 
                        d="M22 2L15 22L11 13L2 9L22 2Z" 
                        stroke="white" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    Send Voicemail
                  </>
                )}
            </Button>
          </Box>
        </>
      )}
      
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                  My Voicemail
              </Typography>
              
              {/* Add sorting controls */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="sort-field-label">Sort by</InputLabel>
                  <Select
                    labelId="sort-field-label"
                    value={sortField}
                    label="Sort by"
                    onChange={handleSortFieldChange}
                  >
                    <MenuItem value="time">Time</MenuItem>
                    <MenuItem value="satoshis">Satoshis</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="sort-order-label">Order</InputLabel>
                  <Select
                    labelId="sort-order-label"
                    value={sortOrder}
                    label="Order"
                    onChange={handleSortOrderChange}
                  >
                    <MenuItem value="desc">Newest/Highest</MenuItem>
                    <MenuItem value="asc">Oldest/Lowest</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
            
            {isLoadingVoicemails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : voicemails.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                Your voicemails will appear here.
              </Typography>
            ) : (
              <List>
                {voicemails.map((voicemail, index) => (
                    <React.Fragment key={voicemail.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Typography 
                              component="span" 
                              sx={{ 
                                mr: 1, 
                                fontWeight: 'bold',
                                color: 'text.secondary',
                                minWidth: '24px'
                              }}
                            >
                              {index + 1}.
                            </Typography>
                            <Typography component="span">From: </Typography>
                            <IdentityCard 
                              identityKey={voicemail.sender} 
                            />
                          </div>
                        }
                        secondary={
                          <div>
                            <div style={{ color: 'text.primary', fontSize: '0.875rem' }}>
                              {new Date(voicemail.timestamp).toLocaleString()}
                            </div>
                            <div style={{ color: 'text.secondary', fontSize: '0.875rem', marginTop: '4px' }}>
                              <Tooltip title={voicemail.id}>
                                <a 
                                  href={createTxLink(getTxIdFromOutpoint(voicemail.id))} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: 'underline', color: 'inherit' }}
                                >
                                  {shortenTxId(getTxIdFromOutpoint(voicemail.id))}
                                </a>
                              </Tooltip>
                            </div>
                            {voicemail.message && (
                              <div style={{ marginTop: '4px' }}>
                                {voicemail.message}
                              </div>
                            )}
                            <div style={{ marginTop: '4px' }}>
                              {voicemail.satoshis} satoshis attached
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <Button 
                                variant="outlined" 
                                color="primary" 
                                size="small"
                                onClick={() => handleRedeemSatoshis(voicemail)}
                              >
                                Redeem Satoshis
                              </Button>
                                {/* <Button 
                                variant="outlined" 
                                color="secondary" 
                                size="small"
                                onClick={() => debugVoicemail(voicemail)}
                              >
                                Debug
                                </Button> */}
                            </div>
                          </div>
                        }
                      />
                    </ListItem>
                    <Box sx={{ px: 2, py: 1 }}>
                      <audio controls src={voicemail.audioUrl} style={{ width: '100%' }} />
                    </Box>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sent Voicemails
            </Typography>
            
            {isLoadingSent ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : sentVoicemails.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
                  Your sent voicemails will appear here.
            </Typography>
            ) : (
              <List>
                {sentVoicemails.map((voicemail, index) => (
                    <React.Fragment key={voicemail.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Typography 
                              component="span" 
                              sx={{ 
                                mr: 1, 
                                fontWeight: 'bold',
                                color: 'text.secondary',
                                minWidth: '24px'
                              }}
                            >
                              {index + 1}.
                            </Typography>
                            <Typography component="span">To: </Typography>
                            <IdentityCard 
                              identityKey={voicemail.recipient || ''} 
                            />
                          </div>
                        }
                        secondary={
                          <div>
                            <div style={{ color: 'text.primary', fontSize: '0.875rem' }}>
                              {new Date(voicemail.timestamp).toLocaleString()}
                            </div>
                            <div style={{ color: 'text.secondary', fontSize: '0.875rem', marginTop: '4px' }}>
                              <Tooltip title={voicemail.id}>
                                <a 
                                  href={createTxLink(getTxIdFromOutpoint(voicemail.id))} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: 'underline', color: 'inherit' }}
                                >
                                  {shortenTxId(getTxIdFromOutpoint(voicemail.id))}
                                </a>
                              </Tooltip>
                            </div>
                            {voicemail.message && (
                              <div style={{ marginTop: '4px' }}>
                                {voicemail.message}
                              </div>
                            )}
                            <div style={{ marginTop: '4px' }}>
                              {voicemail.satoshis} satoshis attached
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <Button 
                                variant="outlined" 
                                color="error" 
                                size="small"
                                onClick={() => processForgetSentVoicemail(voicemail)}
                                disabled={forgettingVoicemailId === voicemail.id}
                              >
                                {forgettingVoicemailId === voicemail.id ? 'Forgetting...' : 'Forget Message'}
                              </Button>
                            </div>
                          </div>
                        }
                      />
                    </ListItem>
                    <Box sx={{ px: 2, py: 1 }}>
                      <audio controls src={voicemail.audioUrl} style={{ width: '100%' }} />
                    </Box>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Archived Voicemails
            </Typography>
            
            {isLoadingArchived ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : archivedVoicemails.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                  Your archived voicemails will appear here after you redeem satoshis.
              </Typography>
            ) : (
              <List>
                {archivedVoicemails.map((voicemail, index) => (
                    <React.Fragment key={voicemail.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Typography 
                              component="span" 
                              sx={{ 
                                mr: 1, 
                                fontWeight: 'bold',
                                color: 'text.secondary',
                                minWidth: '24px'
                              }}
                            >
                              {index + 1}.
                            </Typography>
                            <Typography component="span">From: </Typography>
                            <IdentityCard 
                              identityKey={voicemail.sender} 
                            />
                          </div>
                        }
                        secondary={
                          <div>
                            <div style={{ color: 'text.primary', fontSize: '0.875rem' }}>
                              {new Date(voicemail.timestamp).toLocaleString()}
                            </div>
                            <div style={{ color: 'text.secondary', fontSize: '0.875rem', marginTop: '4px' }}>
                              <Tooltip title={voicemail.id}>
                                <a 
                                  href={createTxLink(getTxIdFromOutpoint(voicemail.id))} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ textDecoration: 'underline', color: 'inherit' }}
                                >
                                  {shortenTxId(getTxIdFromOutpoint(voicemail.id))}
                                </a>
                              </Tooltip>
                            </div>
                            {voicemail.message && (
                              <div style={{ marginTop: '4px' }}>
                                {voicemail.message}
                              </div>
                            )}
                            <div style={{ marginTop: '4px' }}>
                                Created on {new Date(voicemail.timestamp).toLocaleString()}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <Button 
                                variant="outlined" 
                                color="error" 
                                size="small"
                                onClick={() => processForgetArchivedVoicemail(voicemail)}
                                disabled={forgettingVoicemailId === voicemail.id}
                              >
                                {forgettingVoicemailId === voicemail.id ? 'Forgetting...' : 'Forget Message'}
                              </Button>
                            </div>
                          </div>
                        }
                      />
                    </ListItem>
                    <Box sx={{ px: 2, py: 1 }}>
                      <audio controls src={voicemail.audioUrl} style={{ width: '100%' }} />
                    </Box>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {activeTab === 4 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Manage Contacts
            </Typography>
            
            {/* Add Contact Form */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Add New Contact
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Contact Name / Description"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  fullWidth
                  placeholder="Enter a name or description for this contact"
                />
                
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Search Identity
                  </Typography>
                  <IdentitySearchField 
                    key={contactSearchKey}
                    onIdentitySelected={(identity) => {
                      setSelectedIdentity(identity)
                    }}
                  />
                </Box>
                
                {selectedIdentity && (
                  <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Contact Preview
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Name / Description:
                      </Typography>
                      <Typography variant="body1">
                        {newContactName || 'No name provided'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Identity:
                      </Typography>
                      <IdentityCard 
                        identityKey={selectedIdentity.identityKey} 
                      />
                    </Box>
                    
                    <Button 
                      variant="contained" 
                      color="primary"
                      fullWidth
                      disabled={!newContactName.trim()}
                      onClick={handleAddContact}
                    >
                      Create Encrypted On-Chain Contact
                    </Button>
                  </Box>
                )}
                
                {addContactError && (
                  <Typography color="error" variant="body2">
                    {addContactError}
                  </Typography>
                )}
              </Box>
            </Paper>
            
            {/* Contacts List */}
            <Typography variant="subtitle1" gutterBottom>
              Your Contacts
            </Typography>
            {isLoadingContacts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : contacts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                You haven't added any contacts yet.
              </Typography>
            ) : (
              <List>
                {contacts.map((contact, index) => (
                  <ListItem
                      key={contact.identityKey}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography 
                            component="span" 
                            sx={{ 
                              mr: 1, 
                              fontWeight: 'bold',
                              color: 'text.secondary',
                              minWidth: '24px'
                            }}
                          >
                            {index + 1}.
                          </Typography>
                          {contact.name}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <IdentityCard identityKey={contact.identityKey} />
                          <Box sx={{ mt: 1, fontSize: '0.75rem' }}>
                            <span style={{ color: 'text.secondary', marginRight: '4px' }}>txid: </span>
                            <a 
                              href={`https://whatsonchain.com/tx/${contact.txid}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                color: 'white', 
                                textDecoration: 'underline',
                                wordBreak: 'break-all'
                              }}
                            >
                              {shortenTxId(contact.txid)}
                            </a>
                          </Box>
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                              variant="outlined" 
                              color="error" 
                              size="small"
                                onClick={() => handleForgetContactClick(contact)}
                                startIcon={<DeleteIcon />}
                            >
                                Forget Contact
                            </Button>
                            </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Redemption Confirmation Dialog */}
      <Dialog open={redeemOpen} onClose={() => { setRedeemOpen(false) }}>
        <DialogTitle>Redeem Satoshis</DialogTitle>
        <DialogContent>
          <Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1">
                You are about to redeem {selectedVoicemail?.satoshis} satoshis from a voicemail sent by:
              </Typography>
              <Box sx={{ mt: 1 }}>
                <IdentityCard 
                  identityKey={selectedVoicemail?.sender || ''} 
                />
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              This will create a transaction that redeems the satoshis attached to this voicemail.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedeemOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => processRedemption(false)} 
            color="primary" 
            variant="outlined"
            disabled={isRedeeming || isArchiving}
          >
            {isRedeeming ? 'Redeeming...' : 'Redeem Satoshis'}
          </Button>
          <Button 
            onClick={() => processRedemption(true)} 
            color="primary" 
            variant="contained"
            disabled={isRedeeming || isArchiving}
          >
            {isArchiving ? 'Processing...' : 'Redeem & Archive'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debug Dialog */}
      <Dialog open={debugOpen} onClose={() => setDebugOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Voicemail Debug Information</DialogTitle>
        <DialogContent>
          {debugInfo && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Transaction ID:</Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 2 }}>
                {debugInfo.id}
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom>Sender:</Typography>
              <Box sx={{ mb: 2 }}>
                <IdentityCard 
                  identityKey={debugInfo.sender} 
                />
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>Timestamp:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {debugInfo.timestamp}
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom>Satoshis:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {debugInfo.satoshis}
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom>Message:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {debugInfo.message}
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom>Locking Script:</Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                {debugInfo.lockingScript}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDebugOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
        {/* Forget Contact Confirmation Dialog */}
        <Dialog 
          open={forgetContactOpen} 
          onClose={() => setForgetContactOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Forget Contact</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to forget this contact?
              </Typography>
              
              {contactToForget && (
                <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Contact Details
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Name / Description:
                    </Typography>
                    <Typography variant="body1">
                      {contactToForget.name}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Identity:
                    </Typography>
                    <IdentityCard 
                      identityKey={contactToForget.identityKey} 
      />
    </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      This action will:
                    </Typography>
                    <ul>
                      <li>
                        <Typography variant="body2">
                          Remove this contact from your list
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          Redeem the 1 satoshi attached to this contact
                        </Typography>
                      </li>
                    </ul>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForgetContactOpen(false)}>Cancel</Button>
            <Button 
              onClick={processForgetContact} 
              color="error" 
              variant="contained"
            >
              Forget Contact
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      
      <NotificationModal
        open={notification.open}
        message={notification.message}
        type={notification.type}
        title={notification.title}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Container>
  )
}

export default Voicemail 