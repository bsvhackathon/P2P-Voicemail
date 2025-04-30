import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { IdentitySearchField, Identity, IdentityCard } from '@bsv/identity-react'
import NotificationModal from '../NotificationModal'
import { Contact } from '../../types/voicemail';
import { ListOutputsResult, WalletClient, Utils, Transaction, PushDrop, LockingScript, InternalizeActionArgs, ATOMIC_BEEF, AtomicBEEF, InternalizeOutput, BasketInsertion } from "@bsv/sdk";

// Helper function to create Whatsonchain link
const createTxLink = (txid: string): string => {
  return `https://whatsonchain.com/tx/${txid}`;
};

// Helper function to shorten transaction ID
const shortenTxId = (txId: string): string => {
  return `${txId.slice(0, 6)}...${txId.slice(-6)}`;
};

interface ContactListProps {
  contacts: Contact[] | undefined;
  walletClient: WalletClient;
  contactsFromBasket: ListOutputsResult | undefined;
  onContactCreated?: () => void;
}

export const ContactList: React.FC<ContactListProps> = ({contacts, walletClient, contactsFromBasket, onContactCreated}) => {
  const [newContactName, setNewContactName] = useState<string>('')
  const [newContactKey, setNewContactKey] = useState<string>('')
  const [addContactError, setAddContactError] = useState<string>('')
  const [contactSearchKey, setContactSearchKey] = useState<number>(0)
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null)
  const [contactstodisplay, setContactsToDisplay] = useState<Contact[]>([])
  const [isForgetting, setIsForgetting] = useState(false);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [contactToForget, setContactToForget] = useState<Contact | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
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

  // Add useEffect to log contacts state changes
  useEffect(() => {
    if (contacts) {
      setContactsToDisplay(contacts);
    }
  }, [contacts]);

  if (!contacts) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }}>Loading contacts...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const handleForgetContactClick = (contact: Contact) => {
    setContactToForget(contact);
    setForgetDialogOpen(true);
  };

  const processForgetContact = async () => {
    if (!contactToForget || !contactsFromBasket || !walletClient) {
      return;
    }
    
    setIsForgetting(true);
    try {
      const txid = contactToForget.txid;
      let description = `Forget contact ${contactToForget.name}`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      const tx = Transaction.fromBEEF(contactsFromBasket.BEEF as number[], txid);
      const lockingScript = tx!.outputs[0].lockingScript;

      const beefData = contactsFromBasket.BEEF as number[];
      
      let signableTransaction;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('createAction timed out after 30 seconds')), 30000);
        });

        const createActionPromise = walletClient.createAction({
          description,
          inputBEEF: beefData,
          inputs: [{
            inputDescription: 'Forget contact',
            outpoint: `${txid}.0`,
            unlockingScriptLength: 73
          }],
          outputs: [],
          options: {
            randomizeOutputs: false
          }
        });

        const result = await Promise.race([createActionPromise, timeoutPromise]);
        signableTransaction = result.signableTransaction;
      } catch (createActionError) {
        throw createActionError;
      }

      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction');
      }

      const partialTx = Transaction.fromBEEF(signableTransaction.tx);
      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'p2p voicemail contacts'],
        '1',
        'self',
        'all',
        false,
        1,
        lockingScript
      );

      const unlockingScript = await unlocker.sign(partialTx, 0);

      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      });

      setContactsToDisplay(contactstodisplay.filter(c => c.txid !== contactToForget.txid));
      setForgetDialogOpen(false);
      setContactToForget(null);
      
      // Show success notification
      setNotification({
        open: true,
        message: `Successfully forgot contact ${contactToForget.name}`,
        type: 'success',
        title: 'Contact Forgotten'
      });
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to forget contact. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsForgetting(false);
    }
  };

  const handleCreateContact = async () => {
    if (!selectedIdentity || !newContactName.trim()) {
      setAddContactError('Please provide both a name and select an identity');
      return;
    }

    setIsCreating(true);
    try {
      // Create a description for the contact
      let description = `Create contact ${newContactName}`;
      if (description.length > 128) {
        description = description.substring(0, 128);
      }

      // Encrypt the contact data
      const encryptedName = await walletClient.encrypt({
        plaintext: Array.from(Buffer.from(newContactName, 'utf8')),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      });

      const encryptedIdentityKey = await walletClient.encrypt({
        plaintext: Array.from(Buffer.from(selectedIdentity.identityKey, 'utf8')),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      });

      const timestamp = Date.now();
      const encryptedTimestamp = await walletClient.encrypt({
        plaintext: Array.from(Buffer.from(timestamp.toString(), 'utf8')),
        protocolID: [0, 'p2p voicemail contacts'],
        keyID: '1',
        counterparty: 'self'
      });

      // Create the locking script
      const pushDrop = new PushDrop(walletClient);
      const bitcoinOutputScript = await pushDrop.lock(
        [
          encryptedName.ciphertext,
          encryptedIdentityKey.ciphertext,
          encryptedTimestamp.ciphertext
        ],
        [0, 'p2p voicemail contacts'],
        '1',
        'self'
      );

      // Create the transaction
      const tx = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: 1,
          basket: 'p2p voicemail contacts',
          outputDescription: `Contact: ${newContactName}`
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Create encrypted contact: ${newContactName}`
      });

      // Show success message
      setNotification({
        open: true,
        message: `Successfully created contact ${newContactName}`,
        type: 'success',
        title: 'Contact Created'
      });

      // Reset form
      setNewContactName('');
      setSelectedIdentity(null);
      setCreateDialogOpen(false);

      // Reload contacts
      if (onContactCreated) {
        onContactCreated();
      }
    } catch (error) {
      setNotification({
        open: true,
        message: 'Failed to create contact. Please try again.',
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={forgetDialogOpen} onClose={() => !isForgetting && setForgetDialogOpen(false)}>
        <DialogTitle>Forget Contact</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            Are you sure you want to forget this contact?
          </Box>
          {contactToForget && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Name: {contactToForget.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Identity Key: {contactToForget.identityKey}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForgetDialogOpen(false)} disabled={isForgetting}>
            Cancel
          </Button>
          <Button 
            onClick={processForgetContact} 
            color="error"
            disabled={isForgetting}
            startIcon={isForgetting ? <CircularProgress size={20} /> : null}
          >
            {isForgetting ? 'Forgetting...' : 'Forget Contact'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => !isCreating && setCreateDialogOpen(false)}>
        <DialogTitle>Create Contact</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            Are you sure you want to create this contact?
          </Box>
          {selectedIdentity && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Name: {newContactName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Identity Key: {selectedIdentity.identityKey}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateContact} 
            color="primary"
            disabled={isCreating}
            startIcon={isCreating ? <CircularProgress size={20} /> : null}
          >
            {isCreating ? 'Creating...' : 'Create Contact'}
          </Button>
        </DialogActions>
      </Dialog>

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
                    onClick={() => setCreateDialogOpen(true)}
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
            Your Contacts ({contactstodisplay.length})
          </Typography>
          {contactstodisplay.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              You haven't added any contacts yet.
            </Typography>
          ) : (
            <List>
              {contactstodisplay.map((contact, index) => (
                <ListItem
                  key={`${contact.identityKey}-${index}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <Box sx={{ width: '100%' }}>
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
                      <Typography variant="body1" component="div">
                        {contact.name}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      <IdentityCard identityKey={contact.identityKey} />
                      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          <u><a href={createTxLink(contact.txid)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                            {shortenTxId(contact.txid)}
                          </a></u>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Created: {new Date(contact.timestamp || Date.now()).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
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