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
  Checkbox,
  ListItemAvatar,
  Avatar
} from '@mui/material'
import { WalletClient, Utils, Transaction, PushDrop, LockingScript, InternalizeActionArgs, ATOMIC_BEEF, AtomicBEEF, InternalizeOutput, BasketInsertion } from '@bsv/sdk'
import checkForMetaNetClient from '../utils/checkForMetaNetClient'
import NoMncModal from '../components/NoMncModal'
import NotificationModal from '../components/NotificationModal'
import { MessageBoxClient } from '@bsv/p2p'

// Initialize wallet client
const walletClient = new WalletClient()
//instantiate message box client
const messageBoxClient = new MessageBoxClient({
  walletClient: walletClient
})



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
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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

type RedemptionStatus = {
  status: 'pending' | 'success' | 'error';
  message: string;
  txid?: string;
};

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
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false)
  const [internalizedVoicemails, setInternalizedVoicemails] = useState<VoicemailItem[]>([]);
  const [isLoadingInternalized, setIsLoadingInternalized] = useState<boolean>(true);
  const [messageBoxMessages, setMessageBoxMessages] = useState<any[]>([]);

  // Add back sorting state
  const [sortField, setSortField] = useState<SortField>('time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Add back refs
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
    link?: string;
  }>({
    open: false,
    message: '',
    type: 'info',
    title: 'Info',
    link: undefined
  });

  // Add state for forget contact confirmation dialog
  const [forgetContactOpen, setForgetContactOpen] = useState<boolean>(false);
  const [contactToForget, setContactToForget] = useState<Identity & { txid: string } | null>(null);

  // Add new state for transaction confirmation dialog
  const [transactionConfirmOpen, setTransactionConfirmOpen] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    status: 'pending' | 'success' | 'error';
    message: string;
    txid?: string;
  }>({
    status: 'pending',
    message: 'Waiting for transaction confirmation...'
  });

  // Add new state for redemption confirmation dialog
  const [redemptionStatus, setRedemptionStatus] = useState<RedemptionStatus>({
    status: 'pending',
    message: 'Ready to redeem'
  });

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

  // Clear message box messages on component mount
  // useEffect(() => {
  //   const clearMessages = async () => {
  //     try {
  //       const messages = await messageBoxClient.listMessages({
  //         messageBox: 'p2p voicemail rebuild new messagebox'
  //       })
        
  //       if (messages.length > 0) {
  //         const messageIds = messages.map(msg => msg.messageId)
  //         await messageBoxClient.acknowledgeMessage({
  //           messageIds
  //         })
  //         console.log('Cleared', messages.length, 'messages from message box')
  //       }
  //     } catch (error) {
  //       console.error('Error clearing messages:', error)
  //     }
  //   }

  //   clearMessages()
  // }, [])

  // Fetch voicemails when the component first loads
  useEffect(() => {
    fetchVoicemails()
    fetchContacts() // Add this line to fetch contacts on load
    // fetchArchivedVoicemails() // Add this line to fetch archived voicemails on load
  }, [])

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)

    // If switching to the inbox tab, refresh the voicemails and messages
    if (newValue === 1) {
      fetchContacts()   
    }

    // If switching to the contacts tab, refresh the contacts
    else if (newValue === 2) {
      // fetchVoicemails()
    }

  }

  // Fetch voicemails from the user's basket
  const fetchVoicemails = async () => {
    setIsLoadingVoicemails(true)

          // List messages from p2p voicemail message box
          const messages = await messageBoxClient.listMessages({
            messageBox: 'p2p voicemail rebuild new messagebox'
          })
          console.log('p2p voicemail rebuild new messagebox messages:', messages)
          //set to state for checking when redeeming in case message is still there so i may be acknowledged
    try {

      //skip while not needed here 
      // const internalizedOutputs = await walletClient.listOutputs({
      //   basket: 'internalize to new basket',
      //   include: 'entire transactions',
      //   limit: 100 // Add a high limit to get all outputs
      // })

      // const internalizedTxIds = new Set(
      //   internalizedOutputs.outputs.map((output) => output.outpoint.split('.')[0])
      // );
      // console.log('internalizedTxIds:', internalizedTxIds)
      // Acknowledge messages that have already been internalized
      await Promise.all(
        messages.map(async (msg) => {
          try {
            const body = JSON.parse(msg.body);
            const transaction = JSON.parse(body.message);
            const txid = transaction.txid;

            let basket: BasketInsertion = {
              basket: 'internalize to new basket'
            }

            let output: InternalizeOutput = {
              outputIndex: 0,
              protocol: 'basket insertion',
              insertionRemittance: basket
            }

            let args: InternalizeActionArgs = {
              tx: transaction.tx as AtomicBEEF,
              description: 'Internalize voicemail transaction',
              outputs: [output]
            }

            //internalize to basket
            // Internalize the action to the recipient's basket
            await walletClient.internalizeAction(args);

            // If this message's transaction is already internalized, acknowledge it
            // acknowledging after displaying
            // if (internalizedTxIds.has(txid)) {
            //   await messageBoxClient.acknowledgeMessage({
            //     messageIds: [msg.messageId]
            //   });
            //   console.log('Acknowledged message:', msg.messageId);
            // }
          } catch (error) {
            console.error('Error processing message for acknowledgment:', error);
          } 
        })
      );

      // Fetch internalized voicemails after processing messages
      fetchInternalizedVoicemails();

    } catch (error) {
      console.error('Error fetching voicemails:', error)
      setIsLoadingVoicemails(false)
      //fetch again if error 
      fetchVoicemails()
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
    // Re-sort the internalized voicemails with the new field
    setInternalizedVoicemails(sortVoicemails(internalizedVoicemails, newField, sortOrder))
  }

  // Handle sort order change
  const handleSortOrderChange = (event: SelectChangeEvent<SortOrder>) => {
    const newOrder = event.target.value as SortOrder
    setSortOrder(newOrder)
    // Re-sort the internalized voicemails with the new order
    setInternalizedVoicemails(sortVoicemails(internalizedVoicemails, sortField, newOrder))
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

  // New function to handle sending voicemail to someone else
  const processSendVoicemailToSomeoneElse = async () => {
    if (!audioBlob) {
      throw new Error('No audio recording found')
    }
    if (!selectedIdentity) {
      throw new Error('No recipient selected')
    }

    try {
      // Convert audio blob to array of numbers for encryption
      const audioArrayBuffer = await audioBlob.arrayBuffer()
      const audioArray = Array.from(new Uint8Array(audioArrayBuffer))

      // Create a timestamp for when the voicemail was sent
      const timestamp = Date.now()

      // Encrypt the audio data with the recipient's identity key
      const encryptedAudio = await walletClient.encrypt({
        plaintext: audioArray,
        protocolID: [0, 'p2p voicemail rebuild'],
        keyID: '1',
        counterparty: selectedIdentity.identityKey
      })

      // Encrypt the message if provided
      let encryptedMessage: number[] | undefined = undefined
      if (message.trim()) {
        const encryptedMessageData = await walletClient.encrypt({
          plaintext: Utils.toArray(message, 'utf8'),
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: selectedIdentity.identityKey
        })
        encryptedMessage = encryptedMessageData.ciphertext
      }

      // Encrypt the timestamp
      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
        protocolID: [0, 'p2p voicemail rebuild'],
        keyID: '1',
        counterparty: selectedIdentity.identityKey
      })

      // Get the sender's public key
      const keyResult = await walletClient.getPublicKey({ identityKey: true })
      if (!keyResult || !keyResult.publicKey) {
        throw new Error('Failed to get sender public key')
      }

      // Create a PushDrop transaction with the encrypted voicemail
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(keyResult.publicKey, 'utf8'), // Sender's public key
          encryptedAudio.ciphertext, // Encrypted audio data
          encryptedTimestamp.ciphertext, // Encrypted timestamp
          ...(encryptedMessage ? [encryptedMessage] : []) // Add encrypted message if it exists
        ],
        [0, 'p2p voicemail rebuild'],
        '1',
        selectedIdentity.identityKey  // Use recipient's key instead of 'self'
      )

      // Create the transaction with the encrypted voicemail
      const voicemailTransaction = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: satoshiAmount,
          basket: 'internalize to new basket',
          outputDescription: `Voicemail to ${selectedIdentity.name}`
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Send voicemail to ${selectedIdentity.name}`
      })

      console.log('Voicemail sent successfully:', voicemailTransaction.txid)

      // Update transaction status to success
      setTransactionStatus({
        status: 'success',
        message: 'Voicemail sent successfully!',
        txid: voicemailTransaction.txid
      })

      // Send transaction via MessageBoxClient
      await messageBoxClient.sendMessage({
        recipient: selectedIdentity.identityKey,
        messageId: voicemailTransaction.txid,
        messageBox: 'p2p voicemail rebuild new messagebox',
        body: {
          type: 'p2p voicemail rebuild new messagebox',
          txid: voicemailTransaction.txid,
          satoshis: satoshiAmount,
          timestamp: timestamp,
          message: JSON.stringify(voicemailTransaction) || undefined
        }
      })

      // Reset form after successful send
      setSelectedIdentity(null)
      setAudioBlob(null)
      setAudioUrl(null)
      setRecordingTime(0)
      setMessage('')
      setSatoshiAmount(1)

      // Refresh the inbox to update the count
      fetchVoicemails()
      // Set internalized loading to true
      setIsLoadingInternalized(true)

    } catch (error) {
      console.error('Error sending voicemail:', error)
      // Update transaction status to error
      setTransactionStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to send voicemail. Please try again.'
      })
      // Use NotificationModal instead of alert with more specific error message
      setNotification({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to send voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsSending(false)
    }
  }

  // New function to handle sending voicemail to self
  const processSendVoicemailToSelf = async () => {
    // TODO: Implement sending voicemail to self
    console.log('Sending voicemail to self')
    if (!audioBlob) {
      throw new Error('No audio recording found')
    }
    if (!selectedIdentity) {
      throw new Error('No recipient selected')
    }

    try {
      // Convert audio blob to array of numbers for encryption
      const audioArrayBuffer = await audioBlob.arrayBuffer()
      const audioArray = Array.from(new Uint8Array(audioArrayBuffer))

      // Create a timestamp for when the voicemail was sent
      const timestamp = Date.now()

      // Encrypt the audio data with the recipient's identity key
      const encryptedAudio = await walletClient.encrypt({
        plaintext: audioArray,
        protocolID: [0, 'p2p voicemail rebuild'],
        keyID: '1',
        counterparty: 'self'
      })

      // Encrypt the message if provided
      let encryptedMessage: number[] | undefined = undefined
      if (message.trim()) {
        const encryptedMessageData = await walletClient.encrypt({
          plaintext: Utils.toArray(message, 'utf8'),
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: 'self'
        })
        encryptedMessage = encryptedMessageData.ciphertext
      }

      // Encrypt the timestamp
      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
        protocolID: [0, 'p2p voicemail rebuild'],
        keyID: '1',
        counterparty: 'self'
      })

      // Get the sender's public key
      const keyResult = await walletClient.getPublicKey({ identityKey: true })
      if (!keyResult || !keyResult.publicKey) {
        throw new Error('Failed to get sender public key')
      }

      // Create a PushDrop transaction with the encrypted voicemail
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(keyResult.publicKey, 'utf8'), // Sender's public key
          encryptedAudio.ciphertext, // Encrypted audio data
          encryptedTimestamp.ciphertext, // Encrypted timestamp
          ...(encryptedMessage ? [encryptedMessage] : []) // Add encrypted message if it exists
        ],
        [0, 'p2p voicemail rebuild'],
        '1',
        'self'  // Use recipient's key instead of 'self'
      )

      // Create the transaction with the encrypted voicemail
      const voicemailTransaction = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: satoshiAmount,
          basket: 'p2p voicemail to self',
          outputDescription: `Voicemail to ${selectedIdentity.name}`
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Send voicemail to ${selectedIdentity.name}`
      })

      console.log('Voicemail sent successfully:', voicemailTransaction.txid)

      // Update transaction status to success
      setTransactionStatus({
        status: 'success',
        message: 'Voicemail sent successfully!',
        txid: voicemailTransaction.txid
      })

      // no messagebox message if sent to self 

      // Reset form after successful send
      setSelectedIdentity(null)
      setAudioBlob(null)
      setAudioUrl(null)
      setRecordingTime(0)
      setMessage('')
      setSatoshiAmount(1)

      // Refresh the inbox to update the count
      fetchVoicemails()
      // Set internalized loading to true
      setIsLoadingInternalized(true)

    } catch (error) {
      console.error('Error sending voicemail:', error)
      // Update transaction status to error
      setTransactionStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to send voicemail. Please try again.'
      })
      // Use NotificationModal instead of alert with more specific error message
      setNotification({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to send voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsSending(false)
    }
  }

  // Process sending voicemail
  const processSendVoicemail = async () => {
    if (!selectedIdentity || !audioBlob) {
      setConfirmSendOpen(false)
      return
    }

    setIsSending(true)
    setConfirmSendOpen(false)
    setTransactionConfirmOpen(true)
    setTransactionStatus({
      status: 'pending',
      message: 'Waiting for transaction confirmation...'
    })

    // Get the sender's public key
    const keyResult = await walletClient.getPublicKey({ identityKey: true })
    console.log(keyResult.publicKey + " = senderIdentity")
    if (!keyResult || !keyResult.publicKey) {
      throw new Error('Failed to get sender public key')
    }

    if (keyResult.publicKey === selectedIdentity.identityKey) {
      processSendVoicemailToSelf()
    } else {
      //send to someone else and use messagebox 
      processSendVoicemailToSomeoneElse()
    }
  }

  // Handle redeeming satoshis from a voicemail
  const handleRedeemSatoshis = async (voicemail: VoicemailItem) => {
    setSelectedVoicemail(voicemail);
    setRedeemOpen(true);
  }

  // Process the redemption of satoshis
  const processRedemption = async () => {
    if (!selectedVoicemail) return;

    try {
      setIsRedeeming(true); // Set isRedeeming to true when starting the redemption process
      setRedemptionStatus({
        status: 'pending',
        message: 'Redeeming satoshis and forgetting voicemail...'
      });

      // Get the transaction ID from the voicemail
      const txid = selectedVoicemail.id;

      // Fetch the BEEF data for the transaction with a larger limit
      const internalizedOutputs = await walletClient.listOutputs({
        basket: 'internalize to new basket',
        include: 'entire transactions',
        limit: 1000 // Increased limit to ensure we get all transactions
      });

      // Create a description for the redemption
      let description = `Redeem ${selectedVoicemail.satoshis} satoshis from voicemail`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Find the specific transaction in the BEEF data
      const tx = Transaction.fromBEEF(internalizedOutputs.BEEF as number[], txid);
      if (!tx) {
        throw new Error(`Transaction ${txid} not found in BEEF data. Please try refreshing your voicemails and try again.`);
      }

      const lockingScript = tx.outputs[0].lockingScript;

      const decodedPushDrop = PushDrop.decode(lockingScript);
      const senderKey = Utils.toUTF8(decodedPushDrop.fields[0]);

      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: internalizedOutputs.BEEF as number[],
        inputs: [{
          inputDescription: 'Redeem voicemail satoshis',
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
        [0, 'p2p voicemail rebuild'],
        '1',
        senderKey,  // Use sender's key instead of 'self'
        'all',
        false,
        selectedVoicemail.satoshis,
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

      console.log('Satoshis redeemed successfully:', signResult);

      // Show success notification with redemption txid
      if (!signResult.txid) {
        throw new Error('Transaction ID is missing');
      }

      const redemptionTxid = signResult.txid as string;

      // Remove the redeemed voicemail from both lists immediately
      setVoicemails(prevVoicemails => 
        prevVoicemails.filter(v => v.id !== selectedVoicemail.id)
      );
      setInternalizedVoicemails(prevVoicemails => 
        prevVoicemails.filter(v => v.id !== selectedVoicemail.id)
      );

      setRedemptionStatus({
        status: 'success',
        message: 'Voicemail redeemed successfully!',
        txid: redemptionTxid
      });

      // Force a refresh of internalized voicemails
      // fetchInternalizedVoicemails();

    } catch (error) {
      console.error('Error redeeming satoshis:', error);
      // Update redemption status to error with a more descriptive message
      setRedemptionStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to redeem satoshis. Please try refreshing your voicemails and try again.'
      });
    } finally {
      setIsRedeeming(false); // Set isRedeeming back to false when the process completes
    }
  };

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
      const txid = await processCreateEncryptedContact(newContactName, selectedIdentity.identityKey);

      setNotification({
        open: true,
        message: `Contact "${newContactName}" added successfully!`,
        type: 'success' as const,
        title: 'Contact Added',
        link: `https://whatsonchain.com/tx/${txid}`
      });
      setSelectedIdentity(null);
      setNewContactName(''); // Clear the contact name field
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
      return tx.txid; // Return the transaction ID
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
        include: 'entire transactions',
        limit: 25
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
        include: 'entire transactions',
        limit: 25
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

      // Show success notification with transaction ID and WhatsOnChain link
      if (!signResult.txid) {
        throw new Error('Transaction ID is missing');
      }

      const redemptionTxid = signResult.txid as string;

      setNotification({
        open: true,
        message: 'Successfully forgotten contact "' + contactToForget.name + '" and redeemed 1 satoshi!',
        type: 'success' as const,
        title: 'Contact Forgotten',
        link: 'https://whatsonchain.com/tx/' + redemptionTxid
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




  // Add new function to fetch internalized voicemails
  const fetchInternalizedVoicemails = async () => {
    setIsLoadingInternalized(true);
    try {
      const voicemailsFromBasket = await walletClient.listOutputs({
        basket: 'internalize to new basket',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromBasket', voicemailsFromBasket);

      const voicemailsFromSelf = await walletClient.listOutputs({
        basket: 'p2p voicemail to self',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromSelf', voicemailsFromSelf);

      if (!voicemailsFromBasket || !voicemailsFromBasket.outputs) {
        console.log('No voicemails found in basket');
        return;
      }

      // Process both regular internalized voicemails and self-sent voicemails
      const processedRegularVoicemails = await Promise.all(
        voicemailsFromBasket.outputs.map(async (output) => {
          try {
            const voicemailItem = await processVoicemailOutput(output, voicemailsFromBasket.BEEF as number[], false);
            if (voicemailItem) {
              console.log('Successfully processed internalized voicemail:', voicemailItem);
              return voicemailItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing internalized voicemail:', error);
            return null;
          }
        })
      );

      const processedSelfVoicemails = await Promise.all(
        (voicemailsFromSelf?.outputs || []).map(async (output) => {
          try {
            const voicemailItem = await processVoicemailOutput(output, voicemailsFromSelf.BEEF as number[], true);
            if (voicemailItem) {
              console.log('Successfully processed self-sent voicemail:', voicemailItem);
              return voicemailItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing self-sent voicemail:', error);
            return null;
          }
        })
      );

      // Filter out null results and combine both lists
      const validRegularVoicemails = processedRegularVoicemails.filter((voicemail): voicemail is VoicemailItem => voicemail !== null);
      const validSelfVoicemails = processedSelfVoicemails.filter((voicemail): voicemail is VoicemailItem => voicemail !== null);
      
      console.log('Valid regular voicemails found:', validRegularVoicemails.length);
      console.log('Valid self-sent voicemails found:', validSelfVoicemails.length);

      // Combine and sort all voicemails
      const allValidVoicemails = [...validRegularVoicemails, ...validSelfVoicemails];
      const sortedVoicemails = sortVoicemails(allValidVoicemails, sortField, sortOrder);

      setInternalizedVoicemails(sortedVoicemails);

      // After successfully processing and displaying voicemails, acknowledge the messages
      //get messageboxmessages and acknowledge the ones that displayed 
      const messages = await messageBoxClient.listMessages({
        messageBox: 'p2p voicemail rebuild new messagebox'
      })
      console.log('p2p voicemail rebuild new messagebox messages:', messages)

      if (messages.length > 0) {
        try {
          // Only acknowledge messages that exist in our processed voicemails
          const messageIdsToAcknowledge = messages
            .filter(msg => allValidVoicemails.some(v => v.id === msg.messageId))
            .map(msg => msg.messageId);

          if (messageIdsToAcknowledge.length > 0) {
            console.log('Acknowledging messages:', messageIdsToAcknowledge);
            await messageBoxClient.acknowledgeMessage({
              messageIds: messageIdsToAcknowledge
            });
            console.log('Acknowledged', messageIdsToAcknowledge.length, 'messages after successful processing');
            
            // Only remove the acknowledged messages from the state
            // setMessageBoxMessages(prev => prev.filter(msg => !messageIdsToAcknowledge.includes(msg.messageId)));
          }
        } catch (error) {
          console.error('Error acknowledging messages:', error);
        }
      }

    } catch (error) {
      console.error('Error fetching internalized voicemails:', error);
    } finally {
      setIsLoadingInternalized(false);
    }
  };

  const processVoicemailOutput = async (output: any, beefData: number[], isSelf: boolean = false): Promise<VoicemailItem | null> => {
    try {
      const txId = output.outpoint.split('.')[0];
      console.log('Processing transaction:', txId);

      const tx = Transaction.fromBEEF(beefData, txId);

      if (!tx || !tx.outputs || !tx.outputs[0]) {
        console.error('Invalid transaction structure for txId:', txId);
        return null;
      }

      const lockingScript = tx.outputs[0].lockingScript;
      const decodedVoicemail = PushDrop.decode(lockingScript);

      if (!decodedVoicemail || !decodedVoicemail.fields || decodedVoicemail.fields.length < 2) {
        console.error('Invalid PushDrop data structure for txId:', txId);
        return null;
      }

      // Get sender from first field
      const sender = Utils.toUTF8(decodedVoicemail.fields[0]);
      console.log('Processing voicemail from sender:', sender);

      const encryptedAudio = decodedVoicemail.fields[1];

      // Decrypt the audio data with the sender's key
      let decryptedAudioData;

      console.log('Attempting to decrypt audio as recipient');
      decryptedAudioData = await walletClient.decrypt({
        ciphertext: encryptedAudio,
        protocolID: [0, 'p2p voicemail rebuild'],
        keyID: '1',
        counterparty: isSelf ? 'self' : sender
      });
      console.log('Successfully decrypted audio');

      // Convert to audio format
      const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Check if timestamp field exists (field index 2)
      let timestamp = Date.now(); // Default to current time if no timestamp
      if (decodedVoicemail.fields.length > 2) {
        try {
          const encryptedTimestamp = decodedVoicemail.fields[2];
          console.log('Attempting to decrypt timestamp');
          const decryptedTimestampData = await walletClient.decrypt({
            ciphertext: encryptedTimestamp,
            protocolID: [0, 'p2p voicemail rebuild'],
            keyID: '1',
            counterparty: isSelf ? 'self' : sender
          });
          timestamp = parseInt(Utils.toUTF8(decryptedTimestampData.plaintext), 10);
          console.log('Successfully decrypted timestamp:', timestamp);
        } catch (timestampError) {
          console.warn('Error decrypting timestamp:', timestampError);
        }
      }

      // Check if message field exists (field index 3)
      let decryptedMessage = '';
      if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
        try {
          const encryptedMessage = decodedVoicemail.fields[3];
          console.log('Attempting to decrypt message');
          const decryptedMessageData = await walletClient.decrypt({
            ciphertext: encryptedMessage,
            protocolID: [0, 'p2p voicemail rebuild'],
            keyID: '1',
            counterparty: isSelf ? 'self' : sender
          });
          decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext);
          console.log('Successfully decrypted message:', decryptedMessage);
        } catch (messageError) {
          console.warn('Error decrypting message:', messageError);
        }
      }

      const voicemailItem: VoicemailItem = {
        id: txId,
        sender,
        timestamp,
        satoshis: tx.outputs[0].satoshis || 0,
        audioUrl,
        message: decryptedMessage,
        lockingScript: lockingScript.toHex()
      };

      return voicemailItem;
    } catch (error) {
      console.error('Error processing voicemail output:', error);
      return null;
    }
  };

  // Add handleReply function
  const handleReply = (voicemail: VoicemailItem) => {
    // Switch to create voicemail tab
    setActiveTab(0);
    // Set the recipient to the sender of the voicemail
    setSelectedIdentity({
      name: voicemail.senderName || 'Unknown',
      identityKey: voicemail.sender,
      avatarURL: '',
      abbreviatedKey: voicemail.sender.substring(0, 8),
      badgeIconURL: '',
      badgeLabel: '',
      badgeClickURL: ''
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />

      {/* Add the confirmation dialog */}
      <Dialog
        open={confirmSendOpen}
        onClose={() => setConfirmSendOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            background: '#1e1e1e',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          Confirm Send Voicemail
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
                <strong>To:</strong>
              </Typography>
              <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.2)', color: '#fff' }}>
                <Box component="div" sx={{ mb: 1 }}>
                  {selectedIdentity?.name}
                </Box>
                <IdentityCard
                  identityKey={selectedIdentity?.identityKey || ''}
                />
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
                <strong>Recording:</strong>
              </Typography>
              <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.2)' }}>
                <audio controls src={audioUrl || ''} style={{ width: '100%' }} />
              </Box>
            </Box>

            {message && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
                  <strong>Message:</strong>
                </Typography>
                <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.2)', color: '#fff' }}>
                  {message.replace(/\{[^}]*\}/g, '')}
                </Box>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
                <strong>Attached Satoshis:</strong>
              </Typography>
              <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.2)', color: '#fff' }}>
                {satoshiAmount.toLocaleString()} satoshis ({(satoshiAmount / 100000000).toFixed(8)} BSV)
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          pt: 2,
          px: 3,
          pb: 2
        }}>
          <Button
            onClick={() => setConfirmSendOpen(false)}
            sx={{
              color: '#fff',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={processSendVoicemail}
            color="primary"
            variant="contained"
            disabled={isSending}
            sx={{
              bgcolor: '#2e7d32',
              color: '#fff',
              '&:hover': {
                bgcolor: '#1b5e20'
              }
            }}
          >
            {isSending ? 'Sending...' : 'Confirm Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the transaction confirmation dialog */}
      <Dialog
        open={transactionConfirmOpen}
        onClose={() => transactionStatus.status === 'success' ? setTransactionConfirmOpen(false) : undefined}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            background: '#1e1e1e',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          {transactionStatus.status === 'pending' ? 'Confirm Transaction' :
            transactionStatus.status === 'success' ? 'Transaction Confirmed' :
              'Transaction Failed'}
        </DialogTitle>
        <DialogContent sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
            {transactionStatus.status === 'pending' && (
              <>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(247, 147, 26, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <CircularProgress size={50} sx={{ color: '#f7931a' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: '#fff' }}>
                  Please confirm the transaction in your wallet
                </Typography>
                <Typography variant="body1" align="center" sx={{ maxWidth: '80%', color: '#fff' }}>
                  {transactionStatus.message}
                </Typography>
              </>
            )}

            {transactionStatus.status === 'success' && (
              <>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(46, 125, 50, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#2e7d32" />
                  </svg>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary' }}>
                  Voicemail Sent Successfully!
                </Typography>
                <Typography variant="body1" align="center" gutterBottom sx={{ maxWidth: '80%', mb: 3, color: 'text.primary' }}>
                  Your voicemail has been sent and confirmed on the blockchain.
                </Typography>
                {transactionStatus.txid && (
                  <Box sx={{
                    mt: 2,
                    p: 2,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1,
                    width: '100%',
                    maxWidth: '80%',
                    bgcolor: 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                      Transaction ID: {shortenTxId(transactionStatus.txid)}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={{
                        mt: 1,
                        borderColor: 'rgba(46, 125, 50, 0.5)',
                        color: '#2e7d32',
                        '&:hover': {
                          borderColor: '#2e7d32',
                          backgroundColor: 'rgba(46, 125, 50, 0.05)'
                        }
                      }}
                      onClick={() => window.open(`https://whatsonchain.com/tx/${transactionStatus.txid}`, '_blank')}
                    >
                      View on WhatsOnChain
                    </Button>
                  </Box>
                )}
              </>
            )}

            {transactionStatus.status === 'error' && (
              <>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="#d32f2f" />
                  </svg>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary' }}>
                  Transaction Failed
                </Typography>
                <Typography variant="body1" color="error" align="center" sx={{ maxWidth: '80%', color: 'text.primary' }}>
                  {transactionStatus.message}
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          pt: 2,
          px: 3,
          pb: 2
        }}>
          {transactionStatus.status === 'success' && (
            <Button
              onClick={() => setTransactionConfirmOpen(false)}
              color="primary"
              variant="contained"
              sx={{
                bgcolor: '#2e7d32',
                color: 'white',
                '&:hover': {
                  bgcolor: '#1b5e20'
                }
              }}
            >
              Close
            </Button>
          )}
          {transactionStatus.status === 'error' && (
            <Button
              onClick={() => setTransactionConfirmOpen(false)}
              color="primary"
              sx={{ color: 'white' }}
            >
              Close
            </Button>
          )}
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
        <Typography variant="body1" color="text.secondary">
          Thank you for testing the P2P Voicemail hackathon project. Only experiment with tiny micropayments and data that you're willing to lose.<br /><br />
        </Typography>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="voicemail tabs"
          variant="scrollable"
          scrollButtons="auto"          allowScrollButtonsMobile
          sx={{
            mb: 3,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab label="Create Voicemail" />



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
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              Inbox
              {isLoadingInternalized ? (
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
                <Box component="span" sx={{ ml: 1 }}>({internalizedVoicemails.length})</Box>
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

                <Box sx={{ mt: 4, position: 'relative' }}>
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
                        <path d="M12 4C14.21 4 16 5.79 16 8C16 10.21 14.21 12 12 12C9.79 12 8 10.21 8 8C8 5.79 9.79 4 12 4ZM12 14C16.42 14 20 15.79 20 18V20H4V18C4 15.79 7.58 14 12 14Z" fill="white" />
                      </svg>
                      Recipient
                    </Box>
                    {selectedIdentity ? (
                      <>
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
                            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                      </>
                    ) : (
                      <Box sx={{ py: 2, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          No recipient selected. Paste an identity key into the search field above and wait for the dropdown to appear, or choose one of your contacts.
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
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
                    max={100000}
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
                      if (!isNaN(value) && value >= 1 && value <= 100000) {
                        setSatoshiAmount(value);
                      }
                    }}
                    inputProps={{
                      min: 1,
                      max: 100000,
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
              <Typography variant="h6" gutterBottom>
                Contacts
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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Loading contacts...
                  </Typography>
                </Box>
              ) : contacts.length === 0 ? (
                <Typography variant="body1" color="text.secondary">
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
                          </Box>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleForgetContactClick(contact)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'error.main'
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 2 && (
          <Card>
            <CardContent>
              {/* Add sorting controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Inbox
                </Typography>

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

              {/* Rest of the internalized tab content */}
              {isLoadingInternalized ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Loading voicemail...
                  </Typography>
                </Box>
              ) : internalizedVoicemails.length === 0 ? (
                <Typography variant="body1" color="text.secondary">
                  No voicemail found.
                </Typography>
              ) : (
                <List>
                  {internalizedVoicemails.map((voicemail, index) => (
                    <ListItem
                      key={voicemail.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start' }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 'bold',
                                    color: 'text.secondary',
                                    minWidth: '24px'
                                  }}
                                >
                                  {index + 1}.
                                </Typography>
                                <Typography variant="subtitle1">
                                  From:
                                </Typography>
                                <IdentityCard identityKey={voicemail.sender} />
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(voicemail.timestamp).toLocaleString()}
                                </Typography>
                              </Box>
                              <Box sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 1 }}>
                                <Tooltip title={voicemail.id}>
                                  <a
                                    href={`https://whatsonchain.com/tx/${voicemail.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'underline', color: 'inherit' }}
                                  >
                                    {voicemail.id.substring(0, 8)}...{voicemail.id.substring(voicemail.id.length - 8)}
                                  </a>
                                </Tooltip>
                              </Box>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {voicemail.satoshis.toLocaleString()} satoshis attached
                              </Typography>
                              {voicemail.message && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  <strong>Message:</strong> {voicemail.message}
                                </Typography>
                              )}
                              {/* Add the Redeem button */}
                              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  onClick={() => handleRedeemSatoshis(voicemail)}
                                  disabled={isRedeeming}
                                  sx={{
                                    bgcolor: '#2e7d32',
                                    color: 'white',
                                    '&:hover': {
                                      bgcolor: '#1b5e20'
                                    }
                                  }}
                                >
                                  {isRedeeming ? 'Redeeming...' : `Redeem ${voicemail.satoshis.toLocaleString()} Satoshis & Forget`}
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  onClick={() => handleReply(voicemail)}
                                  sx={{
                                    borderColor: 'primary.main',
                                    color: 'primary.main',
                                    '&:hover': {
                                      borderColor: 'primary.dark',
                                      bgcolor: 'primary.main',
                                      color: 'white'
                                    }
                                  }}
                                >
                                  Reply
                                </Button>
                              </Box>
                            </Box>
                          }
                        />
                      </Box>
                      {voicemail.audioUrl && (
                        <Box sx={{ width: '100%', px: 2, py: 1, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                          <audio controls src={voicemail.audioUrl} style={{ width: '100%' }} />
                        </Box>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}


        {/* Redemption Confirmation Dialog */}
        <Dialog
          open={redeemOpen}
          onClose={() => redemptionStatus.status === 'success' ? setRedeemOpen(false) : undefined}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              background: '#1e1e1e', // Lighter dark background
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <DialogTitle sx={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            pb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: 'text.primary'
          }}>
            {redemptionStatus.status === 'pending' ? 'Redeem Satoshis & Forget Voicemail' :
              redemptionStatus.status === 'success' ? 'Redemption Successful' :
                'Redemption Failed'}
          </DialogTitle>
          <DialogContent sx={{ py: 4 }}>
            {redemptionStatus.status === 'pending' && !isRedeeming && (
              <Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    <strong>From:</strong>
                  </Typography>
                  <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)' }}>
                    <IdentityCard
                      identityKey={selectedVoicemail?.sender || ''}
                    />
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    <strong>Received:</strong>
                  </Typography>
                  <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)', color: 'text.primary' }}>
                    {new Date(selectedVoicemail?.timestamp || 0).toLocaleString()}
                  </Box>
                </Box>

                {selectedVoicemail?.message && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                      <strong>Message:</strong>
                    </Typography>
                    <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)', color: 'text.primary' }}>
                      {selectedVoicemail.message}
                    </Box>
                  </Box>
                )}

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    <strong>Satoshis to Redeem:</strong>
                  </Typography>
                  <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)', color: 'text.primary' }}>
                    {selectedVoicemail?.satoshis.toLocaleString()} satoshis ({(selectedVoicemail?.satoshis || 0) / 100000000} BSV)
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    <strong>Transaction ID:</strong>
                  </Typography>
                  <Box sx={{ ml: 2, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.05)', color: 'text.primary' }}>
                    {shortenTxId(selectedVoicemail?.id || '')}
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ color: 'text.primary', mt: 2 }}>
                  This will redeem the satoshis attached to this voicemail and forget the voicemail.
                </Typography>
              </Box>
            )}

            {redemptionStatus.status === 'pending' && isRedeeming && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(247, 147, 26, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                  boxShadow: '0 4px 20px rgba(247, 147, 26, 0.2)',
                  border: '1px solid rgba(247, 147, 26, 0.3)'
                }}>
                  <CircularProgress size={50} sx={{ color: '#f7931a' }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary' }}>
                  Redeeming Satoshis and Forgetting Voicemail
                </Typography>
                <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: '80%', color: 'text.primary', mb: 2 }}>
                  {redemptionStatus.message}
                </Typography>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 2,
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <CircularProgress size={20} sx={{ color: '#f7931a' }} />
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    Please wait...
                  </Typography>
                </Box>
              </Box>
            )}

            {redemptionStatus.status === 'success' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(46, 125, 50, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#2e7d32" />
                  </svg>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary' }}>
                  Voicemail Redeemed Successfully!
                </Typography>
                <Typography variant="body1" align="center" gutterBottom sx={{ maxWidth: '80%', mb: 3, color: 'text.primary' }}>
                  Your voicemail has been redeemed and forgotten.
                </Typography>
                {redemptionStatus.txid && (
                  <Box sx={{
                    mt: 2,
                    p: 2,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 1,
                    width: '100%',
                    maxWidth: '80%',
                    bgcolor: 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                      Transaction ID: {shortenTxId(redemptionStatus.txid)}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={{
                        mt: 1,
                        borderColor: 'rgba(46, 125, 50, 0.5)',
                        color: '#2e7d32',
                        '&:hover': {
                          borderColor: '#2e7d32',
                          backgroundColor: 'rgba(46, 125, 50, 0.05)'
                        }
                      }}
                      onClick={() => window.open(`https://whatsonchain.com/tx/${redemptionStatus.txid}`, '_blank')}
                    >
                      View on WhatsOnChain
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {redemptionStatus.status === 'error' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                <Box sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="#d32f2f" />
                  </svg>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', textAlign: 'center', color: 'text.primary' }}>
                  Redemption Failed
                </Typography>
                <Typography variant="body1" color="error" align="center" sx={{ maxWidth: '80%', color: 'text.primary' }}>
                  {redemptionStatus.message}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            pt: 2,
            px: 3,
            pb: 2
          }}>
            {redemptionStatus.status === 'pending' && !isRedeeming && (
              <>
                <Button
                  onClick={() => setRedeemOpen(false)}
                  sx={{
                    color: 'text.primary',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.05)'
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={processRedemption}
                  color="primary"
                  variant="contained"
                  disabled={isRedeeming}
                  sx={{
                    bgcolor: '#d32f2f',
                    color: 'white',
                    '&:hover': {
                      bgcolor: '#b71c1c'
                    }
                  }}
                >
                  {isRedeeming ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} sx={{ color: 'white' }} />
                      Redeeming...
                    </Box>
                  ) : (
                    'Redeem & Forget'
                  )}
                </Button>
              </>
            )}
            {redemptionStatus.status === 'success' && (
              <Button
                onClick={() => {
                  setRedeemOpen(false);
                  setSelectedVoicemail(null);
                  setRedemptionStatus({
                    status: 'pending',
                    message: 'Waiting for transaction confirmation...'
                  });
                }}
                color="primary"
                variant="contained"
                sx={{
                  bgcolor: '#2e7d32',
                  color: 'white',
                  '&:hover': {
                    bgcolor: '#1b5e20'
                  }
                }}
              >
                Close
              </Button>
            )}
            {redemptionStatus.status === 'error' && (
              <Button
                onClick={() => {
                  setRedeemOpen(false);
                  setSelectedVoicemail(null);
                  setRedemptionStatus({
                    status: 'pending',
                    message: 'Waiting for transaction confirmation...'
                  });
                }}
                color="primary"
                sx={{ color: 'white' }}
              >
                Close
              </Button>
            )}
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
        link={notification.link}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Container>
  )
}

export default Voicemail 