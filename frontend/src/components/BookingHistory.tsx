import React from 'react';
import { 
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, Paper, Button, Chip, CircularProgress, Alert
} from '@mui/material';
import { useQuery } from '@apollo/client';
import { GET_BOOKINGS } from '../graphql/queries';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

export default function BookingHistory(): React.JSX.Element {
  const { data, loading, error, fetchMore } = useQuery(GET_BOOKINGS, {
    variables: { first: 5 },
    fetchPolicy: 'cache-and-network',
  });

  const handleNextPage = () => {
    if (data?.bookings.pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          after: data.bookings.pageInfo.endCursor,
        },
      });
    }
  };

  if (error) return <Alert severity="error">Failed to load booking history.</Alert>;

  const bookings = data?.bookings?.edges.map((e: any) => e.node) || [];
  const hasNextPage = data?.bookings?.pageInfo?.hasNextPage;

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>Booking History</Typography>
      
      <TableContainer component={Paper} sx={{ border: '1px solid #E0E0E0', boxShadow: 'none' }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#FAFAFA' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>Room</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>Start (IST)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>End (IST)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #000' }} align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} color="inherit" />
                </TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking: any) => (
                <TableRow key={booking.id}>
                  <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }}>{booking.title}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }}>{booking.resource.name}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }}>{dayjs(booking.startTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A')}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }}>{dayjs(booking.endTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A')}</TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #E0E0E0' }} align="right">
                    <Chip 
                      label={booking.status} 
                      size="small"
                      sx={{ 
                        borderRadius: 1, 
                        fontWeight: 'bold',
                        backgroundColor: booking.status === 'CONFIRMED' ? '#000' : '#FFF',
                        color: booking.status === 'CONFIRMED' ? '#FFF' : '#000',
                        border: '1px solid #000'
                      }} 
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="outlined" 
          disabled={!hasNextPage || loading}
          onClick={handleNextPage}
          sx={{ borderColor: '#000', color: '#000', '&:hover': { backgroundColor: '#F0F0F0', borderColor: '#000' } }}
        >
          {loading && bookings.length > 0 ? 'Loading...' : 'Load More'}
        </Button>
      </Box>
    </Box>
  );
}
