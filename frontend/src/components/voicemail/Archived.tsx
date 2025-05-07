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
import { VoicemailItem, SortField, SortOrder } from '../../types/voicemail';
import { WalletClient, Transaction, PushDrop, LockingScript } from '@bsv/sdk';
import NotificationModal from '../NotificationModal';

// Helper function to create Whatsonchain link
const createTxLink = (txid: string): string => {
  return `https://whatsonchain.com/tx/${txid}`;
};

// Helper function to shorten transaction ID
const shortenTxId = (txId: string): string => {
  return `${txId.slice(0, 6)}...${txId.slice(-6)}`;
};

// Add formatDate function at the top of the file
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

interface ArchivedProps {
  archivedVoicemails: (VoicemailItem | null)[] | undefined;
  walletClient: WalletClient;
  onVoicemailRedeemed: () => Promise<void>;
}

export const Archived: React.FC<ArchivedProps> = ({ archivedVoicemails, walletClient, onVoicemailRedeemed }) => {
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [isForgetting, setIsForgetting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [localArchivedVoicemails, setLocalArchivedVoicemails] = useState<(VoicemailItem | null)[] | undefined>(archivedVoicemails);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [voicemailToForget, setVoicemailToForget] = useState<VoicemailItem | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    setLocalArchivedVoicemails(archivedVoicemails);
  }, [archivedVoicemails]);

  // Add debug logging and loading state management
  useEffect(() => {
    if (archivedVoicemails) {
      console.log('Archived component received voicemails:', archivedVoicemails);
      console.log('Number of voicemails:', archivedVoicemails.length);
      console.log('Number of non-null voicemails:', archivedVoicemails.filter(v => v !== null).length);
      
      // Set loading to false once we have data
      setIsLoading(false);
    }
  }, [archivedVoicemails]);

  const handleForgetVoicemail = async (voicemail: VoicemailItem) => {
    setIsForgetting(voicemail.id);
    try {
      // Fetch BEEF data from the archived basket
      const archivedOutputs = await walletClient.listOutputs({
        basket: 'p2p voicemail rebuild archived',
        include: 'entire transactions',
        limit: 1000
      });

      // Find the transaction in the archived basket
      const tx = Transaction.fromBEEF(archivedOutputs.BEEF as number[], voicemail.id);
      if (!tx) {
        throw new Error(`Transaction ${voicemail.id} not found in archived basket`);
      }

      // Create a description for the deletion
      let description = `Forget archived voicemail from ${voicemail.sender}`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Create the transaction to delete the voicemail
      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: archivedOutputs.BEEF as number[],
        inputs: [{
          inputDescription: 'Forget archived voicemail',
          outpoint: `${voicemail.id}.0`,
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
        [0, 'p2p voicemail rebuild archived'],
        '1',
        'self',
        'all',
        false,
        1,
        LockingScript.fromHex(voicemail.lockingScript)
      );

      console.log('Created unlocker with protocol:', [0, 'p2p voicemail rebuild archived']);
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
      if (localArchivedVoicemails) {
        const updatedVoicemails = localArchivedVoicemails.filter(v => v?.id !== voicemail.id);
        setLocalArchivedVoicemails(updatedVoicemails);
      }

      await onVoicemailRedeemed();
      setNotification({
        open: true,
        message: 'Voicemail forgotten successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error forgetting voicemail:', error);
      setNotification({
        open: true,
        message: 'Failed to forget voicemail',
        severity: 'error',
      });
    } finally {
      setIsForgetting(null);
      setForgetDialogOpen(false);
      setVoicemailToForget(null);
    }
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
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }}>Loading archived voicemails...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Filter out null voicemails before rendering
  const validVoicemails = archivedVoicemails?.filter((voicemail): voicemail is VoicemailItem => voicemail !== null) || [];

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
              Archived Voicemails ({validVoicemails?.length || 0})
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

          {validVoicemails && validVoicemails.length > 0 ? (
            <List>
              {sortVoicemails(validVoicemails, sortField, sortOrder).map((voicemail, index) => (
                <ListItem
                  key={`${voicemail?.id || index}-${index}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  {voicemail ? (
                    <>
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
                                <Typography component="span" variant="body2" color="text.secondary">
                                  Date: {new Date(voicemail.timestamp).toLocaleString()}
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
                    </>
                  ) : (
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
                            <Typography component="span" color="error">
                              Invalid Archived Voicemail
                            </Typography>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          Transaction ID: {localArchivedVoicemails?.[index]?.id || 'Unknown'}
                        </Typography>
                      }
                    />
                  )}
                  <Box sx={{ display: 'flex', gap: 1 }}>
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
                  </Box>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No archived voicemails found.
            </Typography>
          )}
        </CardContent>
      </Card>

      <NotificationModal
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        type={notification.severity}
        title="Voicemail Forgotten"
      />
    </>
  );
};

export default Archived; 