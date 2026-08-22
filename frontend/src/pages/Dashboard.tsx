import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Card, CardContent, CircularProgress, Alert
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_BOOKINGS } from '../graphql/queries';
import { CANCEL_BOOKING } from '../graphql/mutations';
import BookingModal from '../components/BookingModal';
import BookingHistory from '../components/BookingHistory';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

export default function Dashboard(): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useQuery(GET_BOOKINGS, {
    variables: { first: 5, status: 'CONFIRMED' }, // Get some recent active bookings
    fetchPolicy: 'cache-and-network',
  });

  const [cancelBooking] = useMutation(CANCEL_BOOKING, {
    refetchQueries: [{ query: GET_BOOKINGS }],
  });

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      cancelBooking({ variables: { id } });
    }
  };

  const bookings = data?.bookings?.edges.map((e: any) => e.node) || [];
  const todayCount = bookings.filter((b: any) => dayjs(b.startTime).tz('Asia/Kolkata').isSame(dayjs().tz('Asia/Kolkata'), 'day')).length;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Dashboard</Typography>
        <Button 
          variant="contained" 
          onClick={() => setModalOpen(true)}
          sx={{ backgroundColor: '#000', color: '#fff', '&:hover': { backgroundColor: '#333' } }}
        >
          Book a Room
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, mb: 6, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 300px' }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Today's Bookings</Typography>
              <Typography variant="h3">{loading ? '-' : todayCount}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 300px' }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Upcoming (Confirmed)</Typography>
              <Typography variant="h3">{loading ? '-' : bookings.length}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Typography variant="h6" sx={{ mb: 3 }}>Recent Confirmed Bookings</Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress color="inherit" /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ border: '1px solid #000' }}>Failed to load bookings: {error.message}</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bookings.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              No upcoming bookings.
            </Paper>
          )}
          {bookings.map((booking: any) => (
            <Paper key={booking.id} sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 0.5 }}>{booking.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Room: {booking.resource.name} | Time: {dayjs(booking.startTime).tz('Asia/Kolkata').format('MMM D, h:mm A')} - {dayjs(booking.endTime).tz('Asia/Kolkata').format('h:mm A')} (IST)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small" onClick={() => handleCancel(booking.id)} sx={{ color: '#D32F2F', borderColor: '#D32F2F' }}>
                  Cancel
                </Button>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <BookingHistory />

      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Box>
  );
}
