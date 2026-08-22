import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navigation(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Timeline', path: '/timeline' },
    { label: 'Settings', path: '/settings' },
  ];

  return (
    <AppBar 
      position="static" 
      color="transparent" 
      elevation={0}
      sx={{ 
        borderBottom: '1px solid #000000',
        backgroundColor: '#FFFFFF',
      }}
    >
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, fontWeight: 'bold', letterSpacing: '-0.5px' }}
        >
          ROOM BOOKING
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button 
                key={item.path} 
                onClick={() => navigate(item.path)}
                sx={{ 
                  color: isActive ? '#FFFFFF' : '#000000',
                  backgroundColor: isActive ? '#000000' : 'transparent',
                  border: '1px solid #000000',
                  borderRadius: '4px',
                  px: 3,
                  py: 0.5,
                  '&:hover': {
                    backgroundColor: isActive ? '#333333' : '#F0F0F0',
                  }
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
