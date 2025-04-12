import React from 'react'
import { Modal, Box, Typography, Button, IconButton } from '@mui/material'

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 400 },
  bgcolor: 'background.paper',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  p: 4,
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(145deg, #1a1a1a, #2a2a2a)',
  color: 'white',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #40E0D0, #00CED1)',
  }
}

interface NotificationModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'success' | 'error' | 'info'
  link?: string | undefined
}

const NotificationModal: React.FC<NotificationModalProps> = ({ 
  open, 
  onClose, 
  title, 
  message,
  type = 'info',
  link
}) => {
  // Define colors based on notification type
  const getColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50' // Green
      case 'error':
        return '#F44336' // Red
      case 'info':
      default:
        return '#40E0D0' // Turquoise (site's accent color)
    }
  }

  const color = getColor()

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby='notification-modal-title'
      aria-describedby='notification-modal-description'
      closeAfterTransition
    >
      <Box sx={style}>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              color: 'white',
            }
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconButton>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Box sx={{ 
            width: 40, 
            height: 40, 
            borderRadius: '50%', 
            bgcolor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2
          }}>
            {type === 'success' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={color}/>
              </svg>
            )}
            {type === 'error' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill={color}/>
              </svg>
            )}
            {type === 'info' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill={color}/>
              </svg>
            )}
          </Box>
          <Typography id='notification-modal-title' variant='h5' component='h2' sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
        </Box>
        
        <Typography id='notification-modal-description' sx={{ mt: 2, mb: 3, lineHeight: 1.6 }}>
          {message}
          {link && (
            <Box sx={{ mt: 1 }}>
              <a 
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: color,
                  textDecoration: 'underline'
                }}
              >
                View on WhatsOnChain
              </a>
            </Box>
          )}
        </Typography>
        
        <Button 
          variant="contained" 
          onClick={onClose}
          sx={{ 
            bgcolor: `${color}20`,
            color: color,
            '&:hover': {
              bgcolor: `${color}30`,
            },
            width: '100%',
            py: 1.5
          }}
        >
          Close
        </Button>
      </Box>
    </Modal>
  )
}

export default NotificationModal 