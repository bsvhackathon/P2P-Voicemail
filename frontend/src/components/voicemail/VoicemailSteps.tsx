import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Slider,
  Paper,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { IdentitySearchField, Identity, IdentityCard } from '@bsv/identity-react';
import { VoicemailItem, Contact } from '../../types/voicemail';
import { ListOutputsResult, WalletClient, Utils, Transaction, PushDrop, LockingScript, InternalizeActionArgs, ATOMIC_BEEF, AtomicBEEF, InternalizeOutput, BasketInsertion } from "@bsv/sdk";
import { Mic as MicIcon, Stop as StopIcon, Delete as DeleteIcon, Send as SendIcon, Check as CheckIcon } from '@mui/icons-material';
import NotificationModal from '../NotificationModal';
import { MessageBoxClient } from '@bsv/p2p';

interface NotificationState {
  open: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  title: string;
  link?: string;
}

interface VoicemailStepsProps {
  walletClient: WalletClient;
  onVoicemailSent?: () => void;
  contacts?: Contact[];
}

const VoicemailSteps: React.FC<VoicemailStepsProps> = ({ walletClient, onVoicemailSent, contacts }) => {
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [message, setMessage] = useState('');
  const [satoshis, setSatoshis] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [saveCopy, setSaveCopy] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    type: 'info',
    title: '',
    link: ''
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messageBoxClient = new MessageBoxClient({ walletClient });

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!selectedIdentity;
      case 1:
        return !!audioBlob;
      case 2:
        return true; // Message is optional
      case 3:
        return satoshis > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleStartRecording = async () => {
    if (!selectedIdentity) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      setNotification({
        open: true,
        message: 'Failed to start recording. Please check your microphone permissions.',
        type: 'error',
        title: 'Recording Error'
      });
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    setIsRecording(false);
    mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleDeleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleSendVoicemail = async () => {
    if (!selectedIdentity || !audioBlob) return;

    setIsSending(true);
    try {
      // Get the sender's public key
      const keyResult = await walletClient.getPublicKey({ identityKey: true });
      if (!keyResult || !keyResult.publicKey) {
        throw new Error('Failed to get sender public key');
      }

      // Convert audio blob to array of numbers for encryption
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      const audioArray = Array.from(new Uint8Array(audioArrayBuffer));

      // Create a timestamp for when the voicemail was sent
      const timestamp = Date.now();

      // Check if sending to self
      if (keyResult.publicKey === selectedIdentity.identityKey) {
        // Encrypt the audio data with self key
        const encryptedAudio = await walletClient.encrypt({
          plaintext: audioArray,
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: 'self'
        });

        // Encrypt the message if provided
        let encryptedMessage: number[] | undefined = undefined;
        if (message.trim()) {
          const encryptedMessageData = await walletClient.encrypt({
            plaintext: Utils.toArray(message, 'utf8'),
            protocolID: [0, 'p2p voicemail rebuild'],
            keyID: '1',
            counterparty: 'self'
          });
          encryptedMessage = encryptedMessageData.ciphertext;
        }

        // Encrypt the timestamp
        const encryptedTimestamp = await walletClient.encrypt({
          plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: 'self'
        });

        // Create outputs array
        const outputs = [];

        // Add main output for self
        const pushdrop = new PushDrop(walletClient);
        const bitcoinOutputScript = await pushdrop.lock(
          [
            Utils.toArray(keyResult.publicKey, 'utf8'), // Sender's public key
            encryptedAudio.ciphertext, // Encrypted audio data
            encryptedTimestamp.ciphertext, // Encrypted timestamp
            ...(encryptedMessage ? [encryptedMessage] : []) // Add encrypted message if it exists
          ],
          [0, 'p2p voicemail rebuild'],
          '1',
          'self'
        );

        outputs.push({
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: satoshis,
          basket: 'p2p voicemail to self',
          outputDescription: `Voicemail to self`
        });

        // If saveCopy is checked, add an output for the sent basket
        if (saveCopy) {
          // Re-encrypt the audio data for the sent basket
          const sentEncryptedAudio = await walletClient.encrypt({
            plaintext: audioArray,
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Encrypt the sender for the sent basket
          const encryptedSender = await walletClient.encrypt({
            plaintext: Array.from(Buffer.from(keyResult.publicKey, 'utf8')),
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Re-encrypt the timestamp for the sent basket
          const sentEncryptedTimestamp = await walletClient.encrypt({
            plaintext: Array.from(Buffer.from(timestamp.toString(), 'utf8')),
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Re-encrypt the message for the sent basket if it exists
          let sentEncryptedMessage;
          if (message.trim()) {
            sentEncryptedMessage = await walletClient.encrypt({
              plaintext: Array.from(Buffer.from(message, 'utf8')),
              protocolID: [0, 'p2p voicemail rebuild sent'],
              keyID: '1',
              counterparty: 'self'
            });
          }

          // Create a separate output for the sent basket
          const sentBitcoinOutputScript = await pushdrop.lock(
            [
              encryptedSender.ciphertext, // Encrypted sender
              sentEncryptedAudio.ciphertext, // Re-encrypted audio data
              sentEncryptedTimestamp.ciphertext, // Re-encrypted timestamp
              ...(sentEncryptedMessage ? [sentEncryptedMessage.ciphertext] : []) // Add re-encrypted message if it exists
            ],
            [0, 'p2p voicemail rebuild sent'],
            '1',
            'self'
          );

          outputs.push({
            lockingScript: sentBitcoinOutputScript.toHex(),
            satoshis: 1,
            basket: 'p2p voicemail rebuild sent',
            outputDescription: `Sent voicemail to self`
          });
        }

        // Create the transaction with both outputs
        const voicemailTransaction = await walletClient.createAction({
          outputs,
          options: {
            randomizeOutputs: false,
            acceptDelayedBroadcast: false
          },
          description: `Send voicemail to self`
        });

        // Verify transaction was created successfully
        if (!voicemailTransaction || !voicemailTransaction.txid) {
          throw new Error('Failed to create voicemail transaction');
        }

        // No need to send messagebox notification when sending to self

        // Reset form after successful send
        setAudioBlob(null);
        setAudioUrl(null);
        setMessage('');
        setSatoshis(1);
        setActiveStep(0);
        // Don't reset selectedIdentity to keep the record button enabled

        setNotification({
          open: true,
          message: 'Voicemail sent successfully!',
          type: 'success',
          title: 'Success',
          link: `https://whatsonchain.com/tx/${voicemailTransaction.txid}`
        });

        if (onVoicemailSent) {
          onVoicemailSent();
        }
      } else {
        // Encrypt the audio data with the recipient's identity key
        const encryptedAudio = await walletClient.encrypt({
          plaintext: audioArray,
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: selectedIdentity.identityKey
        });

        // Encrypt the message if provided
        let encryptedMessage: number[] | undefined = undefined;
        if (message.trim()) {
          const encryptedMessageData = await walletClient.encrypt({
            plaintext: Utils.toArray(message, 'utf8'),
            protocolID: [0, 'p2p voicemail rebuild'],
            keyID: '1',
            counterparty: selectedIdentity.identityKey
          });
          encryptedMessage = encryptedMessageData.ciphertext;
        }

        // Encrypt the timestamp
        const encryptedTimestamp = await walletClient.encrypt({
          plaintext: Utils.toArray(timestamp.toString(), 'utf8'),
          protocolID: [0, 'p2p voicemail rebuild'],
          keyID: '1',
          counterparty: selectedIdentity.identityKey
        });

        // Create outputs array
        const outputs = [];

        // Add main output for recipient
        const pushdrop = new PushDrop(walletClient);
        const bitcoinOutputScript = await pushdrop.lock(
          [
            Utils.toArray(keyResult.publicKey, 'utf8'), // Sender's public key
            encryptedAudio.ciphertext, // Encrypted audio data
            encryptedTimestamp.ciphertext, // Encrypted timestamp
            ...(encryptedMessage ? [encryptedMessage] : []) // Add encrypted message if it exists
          ],
          [0, 'p2p voicemail rebuild'],
          '1',
          selectedIdentity.identityKey
        );

        outputs.push({
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: satoshis,
          basket: 'internalize to new basket',
          outputDescription: `Voicemail to ${selectedIdentity.identityKey}`
        });

        // If saveCopy is checked, add an output for the sent basket
        if (saveCopy) {
          // Re-encrypt the audio data for the sent basket with self key
          const sentEncryptedAudio = await walletClient.encrypt({
            plaintext: audioArray,
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Encrypt the sender for the sent basket
          const encryptedSender = await walletClient.encrypt({
            plaintext: Array.from(Buffer.from(keyResult.publicKey, 'utf8')),
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Re-encrypt the timestamp for the sent basket
          const sentEncryptedTimestamp = await walletClient.encrypt({
            plaintext: Array.from(Buffer.from(timestamp.toString(), 'utf8')),
            protocolID: [0, 'p2p voicemail rebuild sent'],
            keyID: '1',
            counterparty: 'self'
          });

          // Re-encrypt the message for the sent basket if it exists
          let sentEncryptedMessage;
          if (message.trim()) {
            sentEncryptedMessage = await walletClient.encrypt({
              plaintext: Array.from(Buffer.from(message, 'utf8')),
              protocolID: [0, 'p2p voicemail rebuild sent'],
              keyID: '1',
              counterparty: 'self'
            });
          }

          // Create a separate output for the sent basket
          const sentBitcoinOutputScript = await pushdrop.lock(
            [
              encryptedSender.ciphertext, // Encrypted sender
              sentEncryptedAudio.ciphertext, // Re-encrypted audio data
              sentEncryptedTimestamp.ciphertext, // Re-encrypted timestamp
              ...(sentEncryptedMessage ? [sentEncryptedMessage.ciphertext] : []) // Add re-encrypted message if it exists
            ],
            [0, 'p2p voicemail rebuild sent'],
            '1',
            'self'
          );

          outputs.push({
            lockingScript: sentBitcoinOutputScript.toHex(),
            satoshis: 1,
            basket: 'p2p voicemail rebuild sent',
            outputDescription: `Sent voicemail to ${selectedIdentity.identityKey}`
          });
        }

        // Create the transaction with both outputs
        const voicemailTransaction = await walletClient.createAction({
          outputs,
          options: {
            randomizeOutputs: false,
            acceptDelayedBroadcast: false
          },
          description: `Send voicemail to ${selectedIdentity.identityKey}`
        });

        // Verify transaction was created successfully
        if (!voicemailTransaction || !voicemailTransaction.txid) {
          throw new Error('Failed to create voicemail transaction');
        }

        // Only send messagebox notification when sending to others
        await messageBoxClient.sendMessage({
          recipient: selectedIdentity.identityKey,
          messageId: voicemailTransaction.txid,
          messageBox: 'p2p voicemail rebuild new messagebox',
          body: {
            type: 'p2p voicemail rebuild new messagebox',
            txid: voicemailTransaction.txid,
            satoshis: satoshis,
            timestamp: timestamp,
            message: JSON.stringify(voicemailTransaction) || undefined
          }
        });

        // Reset form after successful send
        setAudioBlob(null);
        setAudioUrl(null);
        setMessage('');
        setSatoshis(1);
        setActiveStep(0);
        // Don't reset selectedIdentity to keep the record button enabled

        setNotification({
          open: true,
          message: 'Voicemail sent successfully!',
          type: 'success',
          title: 'Success',
          link: `https://whatsonchain.com/tx/${voicemailTransaction.txid}`
        });

        if (onVoicemailSent) {
          onVoicemailSent();
        }
      }
    } catch (error) {
      console.error('Error sending voicemail:', error);
      setNotification({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to send voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsSending(false);
    }
  };

  const steps = [
    {
      label: 'Search For Recipient',
      content: (
        <Box sx={{ mt: 2 }}>
          <IdentitySearchField
            onIdentitySelected={(identity) => {
              setSelectedIdentity(identity);
            }}
          />

          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#fff', textAlign: 'center', mt: 3 }}>
            ...Or Select From Contacts
          </Typography>

          {contacts === undefined ? (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : contacts && contacts.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 2
              }}>
                <List>
                  {contacts.map((contact) => (
                    <ListItem
                      key={`${contact.identityKey}-${contact.txid}`}
                      component="div"
                      onClick={() => {
                        setSelectedIdentity({
                          identityKey: contact.identityKey,
                          name: contact.name,
                          avatarURL: '',
                          abbreviatedKey: contact.identityKey.slice(0, 6),
                          badgeIconURL: '',
                          badgeLabel: '',
                          badgeClickURL: ''
                        });
                      }}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': {
                          borderBottom: 'none'
                        },
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="body1" component="div" sx={{ mb: 1 }}>
                          {contact.name}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <IdentityCard identityKey={contact.identityKey} />
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          ) : null}

          {selectedIdentity && (
            <Box
              sx={{
                mt: 4,
                p: 2,
                border: '2px solid',
                borderColor: 'success.dark',
                borderRadius: 1,
                position: 'relative'
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -12,
                  left: 16,
                  backgroundColor: 'background.default',
                  px: 1,
                }}
              >
                <Typography variant="subtitle2" color="success.dark">
                  Selected Recipient
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {selectedIdentity.name || 'Unknown Contact'}
                </Typography>
              </Box>
              <IdentityCard identityKey={selectedIdentity.identityKey} />
            </Box>
          )}
        </Box>
      )
    },
    {
      label: 'Record Message',
      content: (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            {!isRecording ? (
              <Button
                variant="contained"
                startIcon={<MicIcon />}
                onClick={handleStartRecording}
                disabled={!selectedIdentity}
              >
                Start Recording
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStopRecording}
              >
                Stop Recording
              </Button>
            )}
            {audioUrl && (
              <Button
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteRecording}
              >
                Delete Recording
              </Button>
            )}
          </Box>
          {audioUrl && (
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          )}
        </Box>
      )
    },
    {
      label: 'Add Message (Optional)',
      content: (
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            disabled={!selectedIdentity}
          />
        </Box>
      )
    },
    {
      label: 'Set Satoshis',
      content: (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Slider
              value={satoshis}
              onChange={(_, value) => setSatoshis(value as number)}
              min={1}
              max={1000}
              step={1}
              sx={{ flex: 1 }}
              disabled={!selectedIdentity}
            />
            <TextField
              type="number"
              value={satoshis}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 1 && value <= 1000) {
                  setSatoshis(value);
                }
              }}
              inputProps={{
                min: 1,
                max: 1000,
                step: 1
              }}
              sx={{ width: 100 }}
              disabled={!selectedIdentity}
            />
          </Box>
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={saveCopy}
                  onChange={(e) => setSaveCopy(e.target.checked)}
                  disabled={!selectedIdentity || !audioBlob}
                />
              }
              label="Save a copy?"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={isSending ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleSendVoicemail}
              disabled={isSending || !selectedIdentity || !audioBlob}
              sx={{ minWidth: 200 }}
            >
              {isSending ? 'Sending...' : 'Send Voicemail'}
            </Button>
          </Box>
        </Box>
      )
    }
  ];

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
            Create Voicemail
          </Typography>

          {steps.map((step, index) => (
            <Card key={step.label} sx={{ mb: 4, position: 'relative' }}>
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
                  backgroundColor: isStepComplete(index) ? 'success.main' : 'transparent',
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
                  Step {index + 1}
                </Box>
              </Box>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#fff' }}>
                  {step.label}
                </Typography>
              </Box>
              <CardContent>
                {step.content}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <NotificationModal
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        type={notification.type}
        title={notification.title}
        link={notification.link}
      />
    </>
  );
};

export default VoicemailSteps; 