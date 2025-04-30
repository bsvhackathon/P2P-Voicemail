import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, IconButton, Paper, Button, Card, CardContent, List, ListItem, ListItemText, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import VoicemailSteps from '../components/voicemail/VoicemailSteps';
import { Identity, IdentitySearchField, IdentityCard } from '@bsv/identity-react';
import { Contact, Voicemail, VoicemailItem } from '../types/voicemail';
import { ContactList } from '../components/voicemail/ContactList';
import VoicemailTabs from '../components/voicemail/VoicemailTabs';
import { Inbox } from '../components/voicemail/Inbox';
import { Archived } from '../components/voicemail/Archived';
import { Sent } from '../components/voicemail/Sent';
import { ToDo } from '../components/voicemail/ToDo';

//no mnc modal
import checkForMetaNetClient from '../utils/checkForMetaNetClient'
import NoMncModal from '../components/NoMncModal'
import NotificationModal from '../components/NotificationModal'

//wallet
import { ListOutputsResult, WalletClient, Utils, Transaction, PushDrop, LockingScript, InternalizeActionArgs, ATOMIC_BEEF, AtomicBEEF, InternalizeOutput, BasketInsertion } from "@bsv/sdk";

//messagebox
import { MessageBoxClient, PeerMessage } from '@bsv/p2p'

// Initialize wallet client
const walletClient = new WalletClient()
//instantiate message box client
const messageBoxClient = new MessageBoxClient({
  walletClient: walletClient
})



const GitHubIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      fill="currentColor"
    />
  </svg>
);


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`voicemail-tabpanel-${index}`}
      aria-labelledby={`voicemail-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const VoicemailPage: React.FC = () => {
  const [internalizedbasket, setInternalizedBasket] = useState<ListOutputsResult>();
  const [peermessages, setPeerMessages] = useState<PeerMessage[]>();
  const [contacts, setContacts] = useState<Contact[] | undefined>();
  const [voicemails, setVoicemails] = useState<(VoicemailItem | null)[]>();
  const [voicemailsfromself, setVoicemailsFromSelf] = useState<(VoicemailItem | null)[]>();
  const [archivedVoicemails, setArchivedVoicemails] = useState<(VoicemailItem | null)[]>();
  const [isMncMissing, setIsMncMissing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState(0);
  const [contactslistoutputs, setContactsListOutputs] = useState<ListOutputsResult>();
  const [sentVoicemails, setSentVoicemails] = useState<(VoicemailItem | null)[] | undefined>();


  //check for mnc'  // Run a 1s interval for checking if MNC is running
  useEffect(() => {
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
    }, 100000)

    // Return a cleanup function
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Add fetchdata right away
  useEffect(() => {
    fetchData()
  }, []);

  // Fetch voicemails from the user's basket
  const fetchData = async () => {
    try {
      // List messages from p2p voicemail message box
      const messages = await messageBoxClient.listMessages({
        messageBox: 'p2p voicemail rebuild new messagebox'
      })
      console.log('p2p voicemail rebuild new messagebox messages:', messages)

      if(messages.length>0){
         processPeerMessages(messages)  // This already calls sendDataToInbox()
         sendDataToContacts()
         sendDataToArchived()
         sendDataToSent()
      }else{
         sendDataToInbox()
         sendDataToContacts()
         sendDataToArchived()
         sendDataToSent()
      }
    
    } catch (error) {
      console.error('Error fetching data:', error)
      console.error('Fetching again')
    }
  }

  // process peermessages
  const processPeerMessages = async (messages: PeerMessage[]) => {
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
          await walletClient.internalizeAction(args);

        } catch (error) {
          console.error('Error processing message for acknowledgment:', error);
        } finally {
          sendDataToInbox()
        }
      })
    );
  }

  const sendDataToInbox = async () => {
    try {
      //get voicemails from basket
      const voicemailsFromBasket = await walletClient.listOutputs({
        basket: 'internalize to new basket',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromBasket', voicemailsFromBasket);

      //get voicemails from self basket
      const voicemailsFromSelf = await walletClient.listOutputs({
        basket: 'p2p voicemail to self',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromSelf', voicemailsFromSelf);

      const processedRegularVoicemails: (VoicemailItem | null)[] = await Promise.all(
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

      const processedSelfVoicemails: (VoicemailItem | null)[] = await Promise.all(
        voicemailsFromSelf.outputs.map(async (output) => {
          try {
            const voicemailItem = await processVoicemailOutput(output, voicemailsFromSelf.BEEF as number[], true);
            if (voicemailItem) {
              console.log('Successfully processed self voicemail:', voicemailItem);
              return voicemailItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing self voicemail:', error);
            return null;
          }
        })
      );

      setVoicemails(processedRegularVoicemails);
      setVoicemailsFromSelf(processedSelfVoicemails);
    } catch (error) {
      console.error('Error sending data to inbox:', error);
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

  const processArchivedVoicemailOutput = async (output: any, beefData: number[]): Promise<VoicemailItem | null> => {
    try {
      const txId = output.outpoint.split('.')[0];
      console.log('Processing archived transaction:', txId);

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

      // Get sender from first field (now encrypted)
      let sender;
      try {
        console.log('Attempting to decrypt archived sender');
        const decryptedSenderData = await walletClient.decrypt({
          ciphertext: decodedVoicemail.fields[0],
          protocolID: [0, 'p2p voicemail rebuild archived'],
          keyID: '1',
          counterparty: 'self'
        });
        // The sender is already in UTF-8 format, no need for Utils.toUTF8
        sender = String.fromCharCode.apply(null, decryptedSenderData.plaintext);
        console.log('Successfully decrypted archived sender:', sender);
      } catch (error) {
        console.error('Error decrypting archived sender:', error);
        return null;
      }

      // The audio data in archived voicemails is already encrypted to self
      const encryptedAudio = decodedVoicemail.fields[1];

      // Decrypt the audio data
      let decryptedAudioData;
      try {
        console.log('Attempting to decrypt archived audio');
        decryptedAudioData = await walletClient.decrypt({
          ciphertext: encryptedAudio,
          protocolID: [0, 'p2p voicemail rebuild archived'],
          keyID: '1',
          counterparty: 'self'
        });
        console.log('Successfully decrypted archived audio');
      } catch (error) {
        console.error('Error decrypting archived audio:', error);
        return null;
      }

      // Verify the audio data is valid
      if (!decryptedAudioData || decryptedAudioData.plaintext.length === 0) {
        console.error('Invalid audio data for archived voicemail:', txId);
        return null;
      }

      // Convert to audio format
      const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Get timestamp from transaction data
      let timestamp = Date.now();
      if (decodedVoicemail.fields.length > 2) {
        try {
          const encryptedTimestamp = decodedVoicemail.fields[2];
          console.log('Attempting to decrypt archived timestamp');
          const decryptedTimestampData = await walletClient.decrypt({
            ciphertext: encryptedTimestamp,
            protocolID: [0, 'p2p voicemail rebuild archived'],
            keyID: '1',
            counterparty: 'self'
          });
          const timestampStr = Utils.toUTF8(decryptedTimestampData.plaintext);
          console.log('Decrypted timestamp string:', timestampStr);
          
          const parsedTimestamp = parseInt(timestampStr, 10);
          console.log('Parsed timestamp:', parsedTimestamp);
          
          // Validate timestamp
          if (isNaN(parsedTimestamp)) {
            console.warn('Invalid timestamp format:', timestampStr);
            timestamp = Date.now();
          } else if (parsedTimestamp > Date.now() + 86400000) { // If timestamp is more than 24 hours in the future
            console.warn('Timestamp is in the future:', parsedTimestamp);
            timestamp = Date.now();
          } else {
            timestamp = parsedTimestamp;
          }
          console.log('Final timestamp:', timestamp);
        } catch (timestampError) {
          console.warn('Error decrypting archived timestamp:', timestampError);
        }
      } else {
        console.warn('No timestamp field found in archived voicemail');
      }

      // Check if message field exists (field index 3)
      let decryptedMessage = '';
      if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
        try {
          const encryptedMessage = decodedVoicemail.fields[3];
          console.log('Attempting to decrypt archived message for voicemail:', txId);
          console.log('Encrypted message field exists:', !!encryptedMessage);
          const decryptedMessageData = await walletClient.decrypt({
            ciphertext: encryptedMessage,
            protocolID: [0, 'p2p voicemail rebuild archived'],
            keyID: '1',
            counterparty: 'self'
          });
          decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext);
          console.log('Successfully decrypted archived message:', decryptedMessage);
        } catch (messageError) {
          console.warn('Error decrypting archived message:', messageError);
          console.warn('Error details:', {
            txId,
            fieldsLength: decodedVoicemail.fields.length,
            hasMessageField: !!decodedVoicemail.fields[3]
          });
        }
      } else {
        console.log('No message field found in archived voicemail:', txId);
        console.log('Fields length:', decodedVoicemail.fields.length);
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

      console.log('Successfully processed archived voicemail:', voicemailItem);
      return voicemailItem;
    } catch (error) {
      console.error('Error processing archived voicemail output:', error);
      return null;
    }
  };

  const sendDataToArchived = async () => {
    try {
      //get voicemails from basket
      const voicemailsFromArchivedBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail rebuild archived',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromArchivedBasket', voicemailsFromArchivedBasket);

      const processedArchivedVoicemails: (VoicemailItem | null)[] = await Promise.all(
        voicemailsFromArchivedBasket.outputs.map(async (output) => {
          try {
            const voicemailItem = await processArchivedVoicemailOutput(output, voicemailsFromArchivedBasket.BEEF as number[]);
            if (voicemailItem) {
              console.log('Successfully processed archived voicemail:', voicemailItem);
              return voicemailItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing archived voicemail:', error);
            return null;
          }
        })
      );

      setArchivedVoicemails(processedArchivedVoicemails);
   
    } catch (error) {
      console.error('Error sending data to archived:', error);
    }
  };

  const sendDataToSent = async () => {
    try {
      //get voicemails from basket
      const voicemailsFromSentBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail rebuild sent',
        include: 'entire transactions',
        limit: 1000 // Increased limit to get all voicemails
      });
      console.log('voicemailsFromSentBasket', voicemailsFromSentBasket);

      const processedSentVoicemails: (VoicemailItem | null)[] = await Promise.all(
        voicemailsFromSentBasket.outputs.map(async (output) => {
          try {
            const voicemailItem = await processSentVoicemailOutput(output, voicemailsFromSentBasket.BEEF as number[]);
            if (voicemailItem) {
              console.log('Successfully processed sent voicemail:', voicemailItem);
              return voicemailItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing sent voicemail:', error);
            return null;
          }
        })
      );

      setSentVoicemails(processedSentVoicemails);
   
    } catch (error) {
      console.error('Error sending data to sent:', error);
    }
  };

  const processSentVoicemailOutput = async (output: any, beefData: number[]): Promise<VoicemailItem | null> => {
    try {
      const txId = output.outpoint.split('.')[0];
      console.log('Processing sent transaction:', txId);

      const tx = Transaction.fromBEEF(beefData, txId);

      if (!tx || !tx.outputs || !tx.outputs[1]) {
        console.error('Invalid transaction structure for txId:', txId);
        return null;
      }

      const lockingScript = tx.outputs[1].lockingScript;
      console.log('Locking script:', lockingScript.toHex());
      
      const decodedVoicemail = PushDrop.decode(lockingScript);
      console.log('Decoded voicemail:', decodedVoicemail);
      console.log('Decoded fields:', decodedVoicemail?.fields);

      if (!decodedVoicemail || !decodedVoicemail.fields || decodedVoicemail.fields.length < 2) {
        console.error('Invalid PushDrop data structure for txId:', txId);
        console.error('Decoded voicemail:', decodedVoicemail);
        console.error('Fields:', decodedVoicemail?.fields);
        return null;
      }

      // Get sender from first field (now encrypted)
      let sender;
      try {
        console.log('Attempting to decrypt sent sender');
        console.log('Ciphertext:', decodedVoicemail.fields[0]);
        const decryptedSenderData = await walletClient.decrypt({
          ciphertext: decodedVoicemail.fields[0],
          protocolID: [0, 'p2p voicemail rebuild sent'],
          keyID: '1',
          counterparty: 'self'
        });
        console.log('Decrypted sender data:', decryptedSenderData);
        // The decrypted data is an array of numbers representing the sender's public key
        sender = String.fromCharCode.apply(null, decryptedSenderData.plaintext);
        console.log('Successfully decrypted sent sender:', sender);
      } catch (error) {
        console.error('Error decrypting sent sender:', error);
        return null;
      }

      // The audio data in sent voicemails is encrypted to self
      const encryptedAudio = decodedVoicemail.fields[1];

      // Decrypt the audio data
      let decryptedAudioData;
      try {
        console.log('Attempting to decrypt sent audio');
        decryptedAudioData = await walletClient.decrypt({
          ciphertext: encryptedAudio,
          protocolID: [0, 'p2p voicemail rebuild sent'],
          keyID: '1',
          counterparty: 'self'
        });
        console.log('Successfully decrypted sent audio');
      } catch (error) {
        console.error('Error decrypting sent audio:', error);
        return null;
      }

      // Verify the audio data is valid
      if (!decryptedAudioData || decryptedAudioData.plaintext.length === 0) {
        console.error('Invalid audio data for sent voicemail:', txId);
        return null;
      }

      // Convert to audio format
      const audioBlob = new Blob([new Uint8Array(decryptedAudioData.plaintext)], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Get timestamp from transaction data
      let timestamp = Date.now(); // Default to current time if no timestamp
      if (decodedVoicemail.fields.length > 2) {
        try {
          const encryptedTimestamp = decodedVoicemail.fields[2];
          console.log('Attempting to decrypt sent timestamp');
          const decryptedTimestampData = await walletClient.decrypt({
            ciphertext: encryptedTimestamp,
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });
          const timestampStr = Utils.toUTF8(decryptedTimestampData.plaintext);
          console.log('Decrypted timestamp string:', timestampStr);
          
          const parsedTimestamp = parseInt(timestampStr, 10);
          console.log('Parsed timestamp:', parsedTimestamp);
          
          // Validate timestamp
          if (isNaN(parsedTimestamp)) {
            console.warn('Invalid timestamp format:', timestampStr);
            timestamp = Date.now();
          } else if (parsedTimestamp > Date.now() + 86400000) { // If timestamp is more than 24 hours in the future
            console.warn('Timestamp is in the future:', parsedTimestamp);
            timestamp = Date.now();
          } else {
            timestamp = parsedTimestamp;
          }
          console.log('Final timestamp:', timestamp);
        } catch (timestampError) {
          console.warn('Error decrypting sent timestamp:', timestampError);
        }
      } else {
        console.warn('No timestamp field found in sent voicemail');
      }

      // Check if message field exists (field index 3)
      let decryptedMessage = '';
      if (decodedVoicemail.fields.length > 3 && decodedVoicemail.fields[3]) {
        try {
          const encryptedMessage = decodedVoicemail.fields[3];
          console.log('Attempting to decrypt sent message for voicemail:', txId);
          console.log('Encrypted message field exists:', !!encryptedMessage);
          const decryptedMessageData = await walletClient.decrypt({
            ciphertext: encryptedMessage,
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });
          decryptedMessage = Utils.toUTF8(decryptedMessageData.plaintext);
          console.log('Successfully decrypted sent message:', decryptedMessage);
        } catch (messageError) {
          console.warn('Error decrypting sent message:', messageError);
          console.warn('Error details:', {
            txId,
            fieldsLength: decodedVoicemail.fields.length,
            hasMessageField: !!decodedVoicemail.fields[3]
          });
        }
      } else {
        console.log('No message field found in sent voicemail:', txId);
        console.log('Fields length:', decodedVoicemail.fields.length);
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

      console.log('Successfully processed sent voicemail:', voicemailItem);
      return voicemailItem;
    } catch (error) {
      console.error('Error processing sent voicemail output:', error);
      return null;
    }
  };

  const sendDataToContacts= async () => {
    try {
      //get contacts
      const contactsFromBasket = await walletClient.listOutputs({
        basket: 'p2p voicemail contacts',
        include: 'entire transactions',
        limit: 100
      })
      console.log('contactsfrombasket', contactsFromBasket);
       setContactsListOutputs(contactsFromBasket)
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

                // Decrypt the timestamp
                const encryptedTimestamp = decodedContact.fields[2]
                const decryptedTimestampData = await walletClient.decrypt({
                  ciphertext: encryptedTimestamp,
                  protocolID: [0, 'p2p voicemail contacts'],
                  keyID: '1'
                })
                const timestamp = parseInt(Utils.toUTF8(decryptedTimestampData.plaintext), 10)
    
                // Create a contact object
                return {
                  name: contactName,
                  identityKey: identityKey,
                  txid: txid,
                  timestamp: timestamp
                } as Contact
              } catch (error) {
                console.error('Error decrypting contact:', error)
                return null
              }
            })
          )
          console.log('Decrypted contacts:', decryptedContacts)
          const validContacts = decryptedContacts.filter(
            (contact): contact is Contact => 
              contact !== null && 
              typeof contact.txid === 'string' && 
              typeof contact.identityKey === 'string' &&
              typeof contact.timestamp === 'number'
          )
          console.log('Valid contacts after filter:', validContacts)
          setContacts(validContacts)
        } catch (error) {
          console.error('Error fetching contacts:', error)
        } 
      }
  


  const renderArchivedContent = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Archived Voicemails
        </Typography>
        <Typography color="text.secondary">
          Your archived voicemails will appear here.
        </Typography>
      </Box>
    );
  };

  const receivedVoicemailIds = async (voicemailIds: string[]) => {
    console.log('Received voicemail IDs:', voicemailIds);
    
    try {
      const messages = await messageBoxClient.listMessages({
        messageBox: 'p2p voicemail rebuild new messagebox'
      });
      console.log('p2p voicemail rebuild new messagebox messages:', messages);

      if (messages.length > 0) {
        // Filter messages where messageId matches any of our voicemail transaction IDs
        const messageIdsToAcknowledge = messages
          .filter(msg => voicemailIds.includes(msg.messageId))
          .map(msg => msg.messageId);

        if (messageIdsToAcknowledge.length > 0) {
          console.log('Acknowledging messages:', messageIdsToAcknowledge);
          await messageBoxClient.acknowledgeMessage({
            messageIds: messageIdsToAcknowledge
          });
          console.log('Acknowledged', messageIdsToAcknowledge.length, 'messages after successful processing');
        }
      }
    } catch (error) {
      console.error('Error acknowledging messages:', error);
    }
  };

  const refreshArchivedVoicemails = async () => {
    try {
      // Add a delay before refreshing to ensure the transaction is processed
      await new Promise(resolve => setTimeout(resolve, 4000));
      await sendDataToArchived();
    } catch (error) {
      console.error('Error refreshing archived voicemails:', error);
    }
  };


  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />
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
            display: 'flex',
            gap: 2,
            mt: { xs: 2, md: 0 }
          }}>
            <IconButton
              component="a"
              href="https://bitcoinsv.io"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              <Box
                component="img"
                src="/bitcoin_logo.svg"
                alt="Bitcoin SV"
                sx={{
                  height: 20,
                  width: 'auto',
                  filter: 'brightness(0.8)'
                }}
              />
            </IconButton>
            <IconButton
              component="a"
              href="https://github.com/yourusername/p2p-voicemail"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              <GitHubIcon />
            </IconButton>
          </Box>
        </Box>

        <VoicemailTabs
          contactsCount={contacts?.length || 0}
          onCreateVoicemail={() => (
            <VoicemailSteps 
              walletClient={walletClient} 
              onVoicemailSent={() => {
                sendDataToInbox();
                sendDataToSent();
              }}
              contacts={contacts}
            />
          )}
          onContacts={() => (
            <ContactList 
              contacts={contacts} 
              walletClient={walletClient} 
              contactsFromBasket={contactslistoutputs}
              onContactCreated={sendDataToContacts}
            />
          )}
          onInbox={() => (
            <Inbox 
              internalizedbasket={voicemails} 
              voicemailsfromself={voicemailsfromself} 
              onVoicemailsLoaded={receivedVoicemailIds}
              walletClient={walletClient}
              onVoicemailsUpdated={setVoicemails}
              onSelfVoicemailsUpdated={setVoicemailsFromSelf}
              onVoicemailArchived={refreshArchivedVoicemails}
            />
          )}
          onSent={() => (
            <Sent
              sentVoicemails={sentVoicemails}
              walletClient={walletClient}
              onVoicemailDeleted={sendDataToSent}
            />
          )}
          onArchived={() => (
            <Archived 
              archivedVoicemails={archivedVoicemails}
              walletClient={walletClient}
              onVoicemailRedeemed={refreshArchivedVoicemails}
            />
          )}
          onToDo={() => (
            <ToDo walletClient={walletClient} />
          )}
        />
      </Box>
    </Container>
  );
};

export default VoicemailPage; 