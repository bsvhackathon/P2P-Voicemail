import React from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'

const Layout: React.FC = () => {
  return (
    <Box sx={{ position: 'relative', minHeight: '100vh' }}>
      {/* Main content */}
      <Outlet />
    </Box>
  )
}

export default Layout