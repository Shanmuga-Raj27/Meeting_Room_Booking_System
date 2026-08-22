import React, { useState } from 'react';
import { 
  Box, Typography, Button, TextField, Paper, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Snackbar, CircularProgress
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_RESOURCES } from '../graphql/queries';
import { CREATE_RESOURCE } from '../graphql/mutations';

interface Resource {
  id: string;
  name: string;
  capacity: number;
}

export default function Settings(): React.JSX.Element {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data, loading, error } = useQuery(GET_RESOURCES);
  const [createResource, { loading: creating }] = useMutation(CREATE_RESOURCE, {
    refetchQueries: [{ query: GET_RESOURCES }],
    onError: (err) => setErrorMsg(err.message),
    onCompleted: () => {
      setName('');
      setCapacity('');
      setErrorMsg('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !capacity) {
      setErrorMsg('Name and capacity are required');
      return;
    }
    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum <= 0) {
      setErrorMsg('Capacity must be a positive number');
      return;
    }
    createResource({ variables: { name, capacity: capNum } });
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress color="inherit" /></Box>;
  if (error) return <Alert severity="error" sx={{ borderRadius: 1, border: '1px solid #000' }}>Error loading resources: {error.message}</Alert>;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>Resource Management</Typography>

      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>Add New Resource</Typography>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              label="Room Name"
              variant="outlined"
              size="small"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
            <TextField
              label="Capacity"
              type="number"
              variant="outlined"
              size="small"
              sx={{ width: 150 }}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={creating}
            />
            <Button 
              type="submit" 
              variant="contained" 
              disabled={creating}
              sx={{ 
                height: 40,
                backgroundColor: '#000',
                color: '#fff',
                '&:hover': { backgroundColor: '#333' }
              }}
            >
              {creating ? 'Adding...' : 'Add Room'}
            </Button>
          </Box>
        </form>
      </Paper>

      <Typography variant="h6" sx={{ mb: 2 }}>Available Rooms</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#F9F9F9' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000', width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>Room Code (ID)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }} align="right">Capacity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.resources.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No resources found. Create one above.
                </TableCell>
              </TableRow>
            )}
            {data?.resources.map((resource: Resource, index: number) => (
              <TableRow key={resource.id}>
                <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }}>{index + 1}</TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E0E0E0', fontWeight: 'medium' }}>{resource.name}</TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E0E0E0', fontFamily: 'monospace', color: 'text.secondary', fontSize: '13px' }}>
                  {resource.id.substring(0, 8)}...
                </TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }} align="right">{resource.capacity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar 
        open={!!errorMsg} 
        autoHideDuration={6000} 
        onClose={() => setErrorMsg('')}
        message={errorMsg}
      />
    </Box>
  );
}
