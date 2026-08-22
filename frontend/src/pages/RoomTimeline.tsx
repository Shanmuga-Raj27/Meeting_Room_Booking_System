import React, { useState } from 'react';
import { Box, Typography, Alert, CircularProgress, IconButton } from '@mui/material';
import { useQuery } from '@apollo/client';
import { GET_RESOURCES, GET_BOOKINGS } from '../graphql/queries';
import TimelineGrid from '../components/TimelineGrid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

export default function RoomTimeline(): React.JSX.Element {
  const [selectedDate, setSelectedDate] = useState(dayjs().tz('Asia/Kolkata'));

  const { data: resData, loading: resLoading, error: resError } = useQuery(GET_RESOURCES);
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOKINGS, {
    variables: { 
      status: 'CONFIRMED',
      first: 100 // Fetch a sufficient amount of active bookings
    },
    fetchPolicy: 'cache-and-network',
  });

  const loading = resLoading || bookLoading;
  const error = resError || bookError;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Room Timeline</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #E0E0E0', borderRadius: 1 }}>
            <IconButton onClick={() => setSelectedDate(d => d.subtract(1, 'day'))}>&lt;</IconButton>
            <Typography sx={{ px: 2, fontWeight: 'bold' }}>{selectedDate.format('MMM D, YYYY')}</Typography>
            <IconButton onClick={() => setSelectedDate(d => d.add(1, 'day'))}>&gt;</IconButton>
          </Box>
          <Box onClick={() => setSelectedDate(dayjs().tz('Asia/Kolkata'))} sx={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>
            Today
          </Box>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ border: '1px solid #000' }}>{error.message}</Alert>
      ) : loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress color="inherit" /></Box>
      ) : (
        <TimelineGrid 
          resources={resData?.resources || []} 
          bookings={bookData?.bookings?.edges.map((e: any) => e.node) || []}
          date={selectedDate}
        />
      )}
    </Box>
  );
}
