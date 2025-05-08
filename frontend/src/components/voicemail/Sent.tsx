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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { IdentityCard } from '@bsv/identity-react';
import NotificationModal from '../NotificationModal';
import { VoicemailItem, SortField, SortOrder } from '../../types/voicemail';
import { WalletClient, Transaction, PushDrop, LockingScript } from '@bsv/sdk';

// Helper function to create Whatsonchain link
const createTxLink = (txid: string): string => {
  return `https://whatsonchain.com/tx/${txid}`;
};

// Helper function to shorten transaction ID
const shortenTxId = (txId: string): string => {
  return `${txId.slice(0, 6)}...${txId.slice(-6)}`;
};

interface SentProps {
  sentVoicemails: (VoicemailItem | null)[] | undefined;
  walletClient: WalletClient;
  onVoicemailDeleted: () => Promise<void>;
}

export const Sent: React.FC<SentProps> = ({ sentVoicemails, walletClient, onVoicemailDeleted }) => {
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
    title: 'Info'
  });

  const [isForgetting, setIsForgetting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [localSentVoicemails, setLocalSentVoicemails] = useState<(VoicemailItem | null)[] | undefined>(sentVoicemails);
  const [nullVoicemails, setNullVoicemails] = useState<(VoicemailItem | null)[]>([]);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [voicemailToForget, setVoicemailToForget] = useState<VoicemailItem | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [selectedNullVoicemail, setSelectedNullVoicemail] = useState<{ txid: string; satoshis: number } | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    if (sentVoicemails === undefined) {
      setIsLoading(true);
    } else {
      console.log('Sent component received voicemails:', sentVoicemails);
      console.log('Number of voicemails:', sentVoicemails.length);
      console.log('Number of non-null voicemails:', sentVoicemails.filter(v => v !== null).length);
      setIsLoading(false);
    }
    setLocalSentVoicemails(sentVoicemails);
  }, [sentVoicemails]);

  // Update null voicemails when localSentVoicemails changes
  useEffect(() => {
    if (localSentVoicemails) {
      setNullVoicemails(localSentVoicemails.filter(v => v === null));
    }
  }, [localSentVoicemails]);

  const handleForgetVoicemail = async (voicemail: VoicemailItem) => {
    setIsForgetting(voicemail.id);
    try {
      // Fetch BEEF data from the sent basket
      const sentOutputs = await walletClient.listOutputs({
        basket: 'p2p voicemail rebuild sent',
        include: 'entire transactions',
        limit: 1000
      });

      // Find the transaction in the sent basket
      const tx = Transaction.fromBEEF(sentOutputs.BEEF as number[], voicemail.id);
      if (!tx) {
        throw new Error(`Transaction ${voicemail.id} not found in sent basket`);
      }

      // Create a description for the deletion
      let description = `Forget sent voicemail to ${voicemail.sender}`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Create the transaction to delete the voicemail
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: sentOutputs.BEEF as number[],
        inputs: [{
          inputDescription: 'Forget sent voicemail',
          outpoint: `${voicemail.id}.1`,
          unlockingScriptLength: 73
        }],
        outputs: [],
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
        [0, 'p2p voicemail rebuild sent'],
        '1',
        'self',
        'all',
        false,
        1,
        LockingScript.fromHex(voicemail.lockingScript)
      );

      console.log('Created unlocker with protocol:', [0, 'p2p voicemail rebuild sent']);
      console.log('Locking script:', voicemail.lockingScript);

      const unlockingScript = await unlocker.sign(partialTx, 0);
      console.log('Generated unlocking script:', unlockingScript.toHex());

      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      });

      console.log('Sign result:', signResult);

      if (!signResult.txid) {
        throw new Error('Transaction ID is missing');
      }

      // Remove the deleted voicemail from the local state
      if (localSentVoicemails) {
        const updatedVoicemails = localSentVoicemails.filter(v => v?.id !== voicemail.id);
        setLocalSentVoicemails(updatedVoicemails);
      }

      await onVoicemailDeleted();
      setNotification({
        open: true,
        message: 'Voicemail forgotten successfully',
        type: 'success',
        title: 'Voicemail Forgotten',
        link: `https://whatsonchain.com/tx/${signResult.txid}`
      });
    } catch (error) {
      console.error('Error forgetting voicemail:', error);
      setNotification({
        open: true,
        message: 'Failed to forget voicemail',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsForgetting(null);
      setForgetDialogOpen(false);
      setVoicemailToForget(null);
    }
  };

  const handleRedeemNullVoicemail = async () => {
    if (!selectedNullVoicemail || !walletClient) return;

    setIsRedeeming(true);
    try {
      // Create a description for the redemption
      let description = `Redeem null voicemail ${selectedNullVoicemail.txid}`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Create the transaction to redeem the voicemail
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: [], // We don't need BEEF data for null voicemails
        inputs: [{
          inputDescription: 'Redeem null voicemail',
          outpoint: `${selectedNullVoicemail.txid}.0`,
          unlockingScriptLength: 73
        }],
        outputs: [],
        options: {
          randomizeOutputs: false
        }
      });

      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction');
      }

      // Sign the transaction
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: '' // Empty unlocking script for null voicemails
          }
        }
      });

      if (!signResult.txid) {
        throw new Error('Transaction ID is missing');
      }

      // Remove the redeemed voicemail from the local state
      if (localSentVoicemails) {
        const updatedVoicemails = localSentVoicemails.filter(v => v?.id !== selectedNullVoicemail.txid);
        setLocalSentVoicemails(updatedVoicemails);
      }

      await onVoicemailDeleted();
      setNotification({
        open: true,
        message: 'Null voicemail redeemed successfully',
        type: 'success',
        title: 'Voicemail Redeemed',
        link: `https://whatsonchain.com/tx/${signResult.txid}`
      });
    } catch (error) {
      console.error('Error redeeming null voicemail:', error);
      setNotification({
        open: true,
        message: 'Failed to redeem null voicemail',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsRedeeming(false);
      setRedeemDialogOpen(false);
      setSelectedNullVoicemail(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Function to sort voicemails based on field and order
  const sortVoicemails = (voicemails: VoicemailItem[], field: SortField, order: SortOrder): VoicemailItem[] => {
    return [...voicemails].sort((a, b) => {
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

  // Show loading state while data is being fetched
  if (isLoading || sentVoicemails === undefined) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }}>Loading sent voicemails...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Update the rendering to use localSentVoicemails instead of sentVoicemails
  const validVoicemails = localSentVoicemails?.filter((voicemail): voicemail is VoicemailItem => voicemail !== null) || [];

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
                To: {voicemailToForget.sender}
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
          <Button onClick={() => setForgetDialogOpen(false)} disabled={!!isForgetting}>
            Cancel
          </Button>
          <Button 
            onClick={() => voicemailToForget && handleForgetVoicemail(voicemailToForget)} 
            color="error"
            disabled={!!isForgetting}
            startIcon={isForgetting ? <CircularProgress size={20} /> : null}
          >
            {isForgetting ? 'Forgetting...' : 'Forget Voicemail'}
          </Button>
        </DialogActions>
      </Dialog>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Sent Voicemails ({validVoicemails.length})
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

          {validVoicemails.length > 0 ? (
            <List>
              {sortVoicemails(validVoicemails, sortField, sortOrder).map((voicemail, index) => (
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
                            To: {voicemail.sender}
                          </Typography>
                        </Box>
                        <IdentityCard identityKey={voicemail.sender} />
                      </Box>
                    }
                    secondary={
                      <Box component="span">
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography component="span" variant="body2" color="text.secondary">
                              Date: {formatDate(voicemail.timestamp)}
                            </Typography>
                            <Typography component="span" variant="body2" color="text.secondary">
                              Satoshis: {voicemail.satoshis}
                            </Typography>
                            {voicemail.message && (
                              <Typography component="span" variant="body2" color="text.secondary">
                                Message: {voicemail.message}
                              </Typography>
                            )}
                            <Typography component="span" variant="body2" color="text.secondary">
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
                  <IconButton
                    onClick={() => {
                      setVoicemailToForget(voicemail);
                      setForgetDialogOpen(true);
                    }}
                    disabled={isForgetting === voicemail.id}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'error.main'
                      }
                    }}
                  >
                    {isForgetting === voicemail.id ? <CircularProgress size={24} /> : <DeleteIcon />}
                  </IconButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No sent voicemails found.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Dialog open={redeemDialogOpen} onClose={() => !isRedeeming && setRedeemDialogOpen(false)}>
        <DialogTitle>Redeem Null Voicemail</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            Are you sure you want to redeem this null voicemail?
          </Box>
          {selectedNullVoicemail && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Transaction ID: {selectedNullVoicemail.txid}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Satoshis: {selectedNullVoicemail.satoshis}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedeemDialogOpen(false)} disabled={isRedeeming}>
            Cancel
          </Button>
          <Button 
            onClick={handleRedeemNullVoicemail}
            color="primary"
            disabled={isRedeeming}
            startIcon={isRedeeming ? <CircularProgress size={20} /> : null}
          >
            {isRedeeming ? 'Redeeming...' : 'Redeem'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default Sent; 