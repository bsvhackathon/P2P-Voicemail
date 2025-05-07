import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Tooltip
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { IdentityCard } from '@bsv/identity-react';
import NotificationModal from '../NotificationModal';
import { VoicemailItem, SortField, SortOrder } from '../../types/voicemail';
import { Transaction, PushDrop } from '@bsv/sdk';
import { WalletClient } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';

// Helper function to create Whatsonchain link
const createTxLink = (txid: string): string => {
  return `https://whatsonchain.com/tx/${txid}`;
};

// Helper function to shorten transaction ID
const shortenTxId = (txId: string): string => {
  return `${txId.slice(0, 6)}...${txId.slice(-6)}`;
};

interface InboxProps {
  internalizedbasket: (VoicemailItem | null)[] | undefined;
  voicemailsfromself: (VoicemailItem | null)[] | undefined;
  onVoicemailsLoaded?: (voicemailIds: string[]) => void;
  walletClient: WalletClient;
  onVoicemailsUpdated?: (voicemails: (VoicemailItem | null)[]) => void;
  onSelfVoicemailsUpdated?: (voicemails: (VoicemailItem | null)[]) => void;
  onVoicemailArchived?: () => void;
}

export const Inbox: React.FC<InboxProps> = ({ 
  internalizedbasket, 
  voicemailsfromself, 
  onVoicemailsLoaded, 
  walletClient,
  onVoicemailsUpdated,
  onSelfVoicemailsUpdated,
  onVoicemailArchived
}) => {
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

  const [isForgetting, setIsForgetting] = useState(false);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [voicemailToForget, setVoicemailToForget] = useState<VoicemailItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create merged list of voicemails
  const mergedVoicemails = React.useMemo(() => {
    const basketVoicemails = internalizedbasket || [];
    const selfVoicemails = voicemailsfromself || [];
    return [...basketVoicemails, ...selfVoicemails].filter(voicemail => voicemail !== null) as VoicemailItem[];
  }, [internalizedbasket, voicemailsfromself]);

  // Update loading state when props change
  useEffect(() => {
    if (internalizedbasket === undefined || voicemailsfromself === undefined) {
      setIsLoading(true);
    } else {
      console.log('Inbox component received voicemails:', mergedVoicemails);
      console.log('Number of voicemails:', mergedVoicemails.length);
      setIsLoading(false);
    }
  }, [internalizedbasket, voicemailsfromself, mergedVoicemails]);

  useEffect(() => {
    if (internalizedbasket !== undefined && voicemailsfromself !== undefined) {
      const voicemailIds = mergedVoicemails.map(voicemail => voicemail.id);
      onVoicemailsLoaded?.(voicemailIds);
    }
  }, [internalizedbasket, voicemailsfromself, mergedVoicemails, onVoicemailsLoaded]);

  useEffect(() => {
    console.log('Merged voicemails:', mergedVoicemails);
  }, [mergedVoicemails]);

  // Function to sort voicemails based on field and order
  const sortVoicemails = (voicemails: (VoicemailItem | null)[] | undefined, field: SortField, order: SortOrder): VoicemailItem[] => {
    if (!voicemails) return [];
    return [...voicemails]
      .filter((voicemail): voicemail is VoicemailItem => voicemail !== null)
      .sort((a, b) => {
        if (field === 'time') {
          return order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
        } else { // satoshis
          return order === 'desc' ? b.satoshis - a.satoshis : a.satoshis - b.satoshis;
        }
      });
  };

  // Handle sort field change
  const handleSortFieldChange = (event: SelectChangeEvent<SortField>) => {
    const newField = event.target.value as SortField;
    setSortField(newField);
  };

  // Handle sort order change
  const handleSortOrderChange = (event: SelectChangeEvent<SortOrder>) => {
    const newOrder = event.target.value as SortOrder;
    setSortOrder(newOrder);
  };

  const handleForgetVoicemailClick = (voicemail: VoicemailItem) => {
    setVoicemailToForget(voicemail);
    setForgetDialogOpen(true);
  };

  const processForgetVoicemail = async () => {
    if (!voicemailToForget) return;
    
    setIsForgetting(true);
    try {
      // TODO: Implement voicemail forgetting logic
      setNotification({
        open: true,
        message: `Successfully forgot voicemail from ${voicemailToForget.sender}`,
        type: 'success',
        title: 'Voicemail Forgotten'
      });
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to forget voicemail. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsForgetting(false);
      setForgetDialogOpen(false);
      setVoicemailToForget(null);
    }
  };

  const handleRedeemSatoshis = async (voicemail: VoicemailItem) => {
    setIsRedeeming(voicemail.id);
    try {
      // Fetch BEEF data from both baskets
      const [internalizedOutputs, selfOutputs] = await Promise.all([
        walletClient.listOutputs({
          basket: 'internalize to new basket',
          include: 'entire transactions',
          limit: 1000
        }),
        walletClient.listOutputs({
          basket: 'p2p voicemail to self',
          include: 'entire transactions',
          limit: 1000
        })
      ]);

      // Try to find the transaction in either basket
      let tx;
      let beefData;
      let isSelf = false;

      // First try internalized basket
      try {
        tx = Transaction.fromBEEF(internalizedOutputs.BEEF as number[], voicemail.id);
        beefData = internalizedOutputs.BEEF as number[];
      } catch (error) {
        // If not found in internalized, try self basket
        try {
          tx = Transaction.fromBEEF(selfOutputs.BEEF as number[], voicemail.id);
          beefData = selfOutputs.BEEF as number[];
          isSelf = true;
        } catch (error) {
          throw new Error(`Transaction ${voicemail.id} not found in either basket. Please try refreshing your voicemails and try again.`);
        }
      }

      if (!tx) {
        throw new Error(`Transaction ${voicemail.id} not found in either basket. Please try refreshing your voicemails and try again.`);
      }

      const lockingScript = tx.outputs[0].lockingScript;
      const decodedPushDrop = PushDrop.decode(lockingScript);
      const senderKey = Utils.toUTF8(decodedPushDrop.fields[0]);

      // Get the audio data from the Blob URL
      const response = await fetch(voicemail.audioUrl);
      const audioBlob = await response.blob();
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      const audioBytes = new Uint8Array(audioArrayBuffer);

      // Re-encrypt the audio data to self for archiving
      const reEncryptedAudio = await walletClient.encrypt({
        plaintext: Array.from(audioBytes),
        protocolID: [0, 'p2p voicemail rebuild archived'],
        keyID: '1',
        counterparty: 'self'
      });

      // Encrypt the sender
      const encryptedSender = await walletClient.encrypt({
        plaintext: Array.from(Buffer.from(voicemail.sender, 'utf8')),
        protocolID: [0, 'p2p voicemail rebuild archived'],
        keyID: '1',
        counterparty: 'self'
      });

      // Encrypt the timestamp
      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Array.from(Buffer.from(voicemail.timestamp.toString(), 'utf8')),
        protocolID: [0, 'p2p voicemail rebuild archived'],
        keyID: '1',
        counterparty: 'self'
      });

      // Encrypt the message if it exists
      let encryptedMessage;
      if (voicemail.message) {
        encryptedMessage = await walletClient.encrypt({
          plaintext: Array.from(Buffer.from(voicemail.message, 'utf8')),
          protocolID: [0, 'p2p voicemail rebuild archived'],
          keyID: '1',
          counterparty: 'self'
        });
      }

      // Create a description for the redemption
      let description = `Redeem ${voicemail.satoshis} satoshis from voicemail`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Create the transaction to redeem the satoshis
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: beefData,
        inputs: [{
          inputDescription: 'Redeem voicemail satoshis',
          outpoint: `${voicemail.id}.0`,
          unlockingScriptLength: 73
        }],
        outputs: [{
          satoshis: 2,
          basket: 'p2p voicemail rebuild archived',
          outputDescription: `Archive voicemail from ${voicemail.sender}`,
          lockingScript: (await new PushDrop(walletClient).lock(
            [
              encryptedSender.ciphertext,
              reEncryptedAudio.ciphertext,
              encryptedTimestamp.ciphertext,
              ...(encryptedMessage ? [encryptedMessage.ciphertext] : [])
            ],
            [0, 'p2p voicemail rebuild archived'],
            '1',
            'self'
          )).toHex()
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
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
        voicemail.satoshis,
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

      if (!signResult.txid) {
        throw new Error('Transaction ID is missing');
      }

      // Remove the redeemed voicemail from the list
      if (isSelf) {
        const updatedSelfVoicemails = voicemailsfromself?.filter(v => v?.id !== voicemail.id) || [];
        onSelfVoicemailsUpdated?.(updatedSelfVoicemails);
      } else {
        const updatedVoicemails = internalizedbasket?.filter(v => v?.id !== voicemail.id) || [];
        onVoicemailsUpdated?.(updatedVoicemails);
      }

      // After successful redemption and archiving, call the refresh function
      if (onVoicemailArchived) {
        onVoicemailArchived();
      }

      setNotification({
        open: true,
        message: 'Voicemail redeemed successfully!',
        type: 'success',
        title: 'Success',
        link: `https://whatsonchain.com/tx/${signResult.txid}`
      });

      // Refresh the inbox to update the list
      if (onVoicemailsLoaded) {
        onVoicemailsLoaded([]);
      }
    } catch (error) {
      console.error('Error redeeming satoshis:', error);
      setNotification({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to redeem satoshis. Please try refreshing your voicemails and try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsRedeeming(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }}>Loading voicemails...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Dialog open={forgetDialogOpen} onClose={() => !isForgetting && setForgetDialogOpen(false)}>
        <DialogTitle>Forget Voicemail</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            Are you sure you want to forget this voicemail?
          </Box>
          {voicemailToForget && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                From: {voicemailToForget.sender}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {formatDate(voicemailToForget.timestamp)}
              </Typography>
              {voicemailToForget.message && (
                <Typography variant="body2" color="text.secondary">
                  Message: {voicemailToForget.message}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForgetDialogOpen(false)} disabled={isForgetting}>
            Cancel
          </Button>
          <Button 
            onClick={processForgetVoicemail} 
            color="error"
            disabled={isForgetting}
            startIcon={isForgetting ? <CircularProgress size={20} /> : null}
          >
            {isForgetting ? 'Forgetting...' : 'Forget Voicemail'}
          </Button>
        </DialogActions>
      </Dialog>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" gutterBottom>
                Inbox ({mergedVoicemails.length})
                    </Typography>
                  </Box>

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

          {mergedVoicemails.length > 0 ? (
            <List>
              {sortVoicemails(mergedVoicemails, sortField, sortOrder).map((voicemail, index) => (
                <ListItem
                  key={`${voicemail.id}-${index}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemText
                    primary={
                      <Box component="span">
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
                          <Typography component="span">
                            From: {voicemail.sender}
                          </Typography>
                        </Box>
                        <IdentityCard identityKey={voicemail.sender} />
                      </Box>
                    }
                    secondary={
                      <Box component="span">
                      <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                              Date: {formatDate(voicemail.timestamp)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                              Satoshis: {voicemail.satoshis}
                            </Typography>
                            {voicemail.message && (
                              <Typography variant="body2" color="text.secondary">
                                Message: {voicemail.message}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary">
                              <u><a href={createTxLink(voicemail.id)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                                {shortenTxId(voicemail.id)}
                              </a></u>
                          </Typography>
                          </Box>
                          <audio controls src={voicemail.audioUrl} style={{ width: '100%', marginTop: 1 }} />
                        </Box>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                    size="small"
                      onClick={() => handleRedeemSatoshis(voicemail)}
                      disabled={isRedeeming === voicemail.id}
                      startIcon={isRedeeming === voicemail.id ? <CircularProgress size={20} /> : null}
                    >
                      {isRedeeming === voicemail.id ? 'Redeeming...' : `Redeem ${voicemail.satoshis} satoshis and archive`}
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No voicemails found.
            </Typography>
          )}
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