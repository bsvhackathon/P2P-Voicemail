import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { VoicemailItem } from '../../types/voicemail';

interface VoicemailTabsProps {
  contactsCount: number;
  onCreateVoicemail: () => React.ReactNode;
  onContacts: () => React.ReactNode;
  onInbox: () => React.ReactNode;
  onSent: () => React.ReactNode;
  onArchived: () => React.ReactNode;
  onToDo: () => React.ReactNode;
  archivedVoicemails?: (VoicemailItem | null)[];
}

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
        <Box sx={{ p: 3, minHeight: '400px' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const VoicemailTabs: React.FC<VoicemailTabsProps> = ({
  contactsCount,
  onCreateVoicemail,
  onContacts,
  onInbox,
  onSent,
  onArchived,
  onToDo,
  archivedVoicemails
}) => {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="voicemail tabs">
          <Tab label="Create Voicemail" id="voicemail-tab-0" />
          <Tab 
            label="Contacts"
            id="voicemail-tab-1" 
          />
          <Tab label="Inbox" id="voicemail-tab-2" />
          <Tab label="Sent" id="voicemail-tab-3" />
          <Tab label="Archived" id="voicemail-tab-4" />
          <Tab label="To-do" id="voicemail-tab-5" />
        </Tabs>
      </Box>
      {value === 0 && (
        <TabPanel value={value} index={0}>
          {onCreateVoicemail()}
        </TabPanel>
      )}
      {value === 1 && (
        <TabPanel value={value} index={1}>
          {onContacts()}
        </TabPanel>
      )}
      {value === 2 && (
        <TabPanel value={value} index={2}>
          {onInbox()}
        </TabPanel>
      )}
      {value === 3 && (
        <TabPanel value={value} index={3}>
          {onSent()}
        </TabPanel>
      )}
      {value === 4 && (
        <TabPanel value={value} index={4}>
          {onArchived()}
        </TabPanel>
      )}
      {value === 5 && (
        <TabPanel value={value} index={5}>
          {onToDo()}
        </TabPanel>
      )}
    </Box>
  );
};

export default VoicemailTabs; 