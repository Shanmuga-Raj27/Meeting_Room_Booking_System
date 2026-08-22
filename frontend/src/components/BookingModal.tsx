import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, FormControl, InputLabel, Select, MenuItem, Alert, Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_BOOKING, RESCHEDULE_BOOKING } from '../graphql/mutations';
import { GET_RESOURCES, GET_BOOKINGS } from '../graphql/queries';

// Configure Dayjs for Indian Standard Time
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  bookingToEdit?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    resourceId: string;
  } | null;
}

const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return '';
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const ext = error.graphQLErrors[0].extensions;
    const code = ext?.code;
    
    switch (code) {
      case 'INVALID_TIME_RANGE':
        return 'The meeting start time must be strictly before the end time.';
      case 'RESOURCE_UNAVAILABLE':
        return 'The room is already booked for the selected time range. Please choose another slot.';
      case 'CONCURRENCY_CONFLICT':
        return 'This slot was just booked by someone else. Please try another slot.';
      case 'RESOURCE_NOT_FOUND':
        return 'The selected room could not be found.';
      case 'BOOKING_NOT_FOUND':
        return 'The booking could not be found.';
      case 'BOOKING_ALREADY_CANCELLED':
        return 'This booking is already cancelled.';
      default:
        return error.graphQLErrors[0].message || 'An unexpected error occurred.';
    }
  }
  return error.message || 'Network error: Failed to connect to the server.';
};

export default function BookingModal({ open, onClose, bookingToEdit }: BookingModalProps) {
  const isEditing = !!bookingToEdit;

  const [title, setTitle] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs().tz('Asia/Kolkata'));
  
  // Separate states for Hour, Minute, and AM/PM to make the ":" non-editable
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState('AM');
  
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState('AM');
  
  const [errorMsg, setErrorMsg] = useState('');

  const { data: resourceData } = useQuery(GET_RESOURCES);

  // Sync inputs on open or edit change
  useEffect(() => {
    if (open) {
      if (bookingToEdit) {
        const start = dayjs(bookingToEdit.startTime).tz('Asia/Kolkata');
        const end = dayjs(bookingToEdit.endTime).tz('Asia/Kolkata');
        setTitle(bookingToEdit.title);
        setResourceId(bookingToEdit.resourceId);
        setSelectedDate(start);
        
        const startHour24 = start.hour();
        const startHour12 = startHour24 % 12 === 0 ? 12 : startHour24 % 12;
        setStartHour(startHour12.toString().padStart(2, '0'));
        setStartMinute(start.minute().toString().padStart(2, '0'));
        setStartPeriod(startHour24 >= 12 ? 'PM' : 'AM');

        const endHour24 = end.hour();
        const endHour12 = endHour24 % 12 === 0 ? 12 : endHour24 % 12;
        setEndHour(endHour12.toString().padStart(2, '0'));
        setEndMinute(end.minute().toString().padStart(2, '0'));
        setEndPeriod(endHour24 >= 12 ? 'PM' : 'AM');
      } else {
        setTitle('');
        setResourceId('');
        setSelectedDate(dayjs().tz('Asia/Kolkata'));
        
        const start = dayjs().tz('Asia/Kolkata').startOf('hour').add(1, 'hour');
        const end = dayjs().tz('Asia/Kolkata').startOf('hour').add(2, 'hour');
        
        const startHour24 = start.hour();
        const startHour12 = startHour24 % 12 === 0 ? 12 : startHour24 % 12;
        setStartHour(startHour12.toString().padStart(2, '0'));
        setStartMinute('00');
        setStartPeriod(startHour24 >= 12 ? 'PM' : 'AM');

        const endHour24 = end.hour();
        const endHour12 = endHour24 % 12 === 0 ? 12 : endHour24 % 12;
        setEndHour(endHour12.toString().padStart(2, '0'));
        setEndMinute('00');
        setEndPeriod(endHour24 >= 12 ? 'PM' : 'AM');
      }
      setErrorMsg('');
    }
  }, [open, bookingToEdit]);

  const [createBooking, { loading: creating }] = useMutation(CREATE_BOOKING, {
    refetchQueries: [{ query: GET_BOOKINGS }],
    onCompleted: () => {
      onClose();
    },
    onError: (err) => setErrorMsg(getFriendlyErrorMessage(err)),
  });

  const [rescheduleBooking, { loading: rescheduling }] = useMutation(RESCHEDULE_BOOKING, {
    refetchQueries: [{ query: GET_BOOKINGS }],
    onCompleted: () => {
      onClose();
    },
    onError: (err) => setErrorMsg(getFriendlyErrorMessage(err)),
  });

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = () => {
    setErrorMsg('');

    if (!title.trim() || !resourceId || !selectedDate || !startHour || !startMinute || !endHour || !endMinute) {
      setErrorMsg('All fields are required.');
      return;
    }

    const hNumStart = parseInt(startHour, 10);
    const mNumStart = parseInt(startMinute, 10);
    const hNumEnd = parseInt(endHour, 10);
    const mNumEnd = parseInt(endMinute, 10);

    if (isNaN(hNumStart) || hNumStart < 1 || hNumStart > 12 || isNaN(mNumStart) || mNumStart < 0 || mNumStart > 59) {
      setErrorMsg('Invalid Start Time values. Hours must be 01-12, minutes 00-59.');
      return;
    }
    if (isNaN(hNumEnd) || hNumEnd < 1 || hNumEnd > 12 || isNaN(mNumEnd) || mNumEnd < 0 || mNumEnd > 59) {
      setErrorMsg('Invalid End Time values. Hours must be 01-12, minutes 00-59.');
      return;
    }

    let start24H = hNumStart;
    if (startPeriod === 'PM' && hNumStart !== 12) start24H += 12;
    if (startPeriod === 'AM' && hNumStart === 12) start24H = 0;

    let end24H = hNumEnd;
    if (endPeriod === 'PM' && hNumEnd !== 12) end24H += 12;
    if (endPeriod === 'AM' && hNumEnd === 12) end24H = 0;

    const startVal = selectedDate.tz('Asia/Kolkata').hour(start24H).minute(mNumStart).second(0).millisecond(0);
    const endVal = selectedDate.tz('Asia/Kolkata').hour(end24H).minute(mNumEnd).second(0).millisecond(0);

    if (startVal.isAfter(endVal) || startVal.isSame(endVal)) {
      setErrorMsg('Start time must be strictly before end time.');
      return;
    }

    const inputVariables = {
      title,
      resourceId,
      startTime: startVal.toISOString(),
      endTime: endVal.toISOString(),
    };

    if (isEditing) {
      rescheduleBooking({ 
        variables: { 
          id: bookingToEdit.id, 
          startTime: inputVariables.startTime, 
          endTime: inputVariables.endTime 
        } 
      });
    } else {
      createBooking({ variables: inputVariables });
    }
  };

  const loading = creating || rescheduling;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #E0E0E0' }}>
        {isEditing ? 'Reschedule Booking' : 'Book a Room'}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1, border: '1px solid #000' }}>
            {errorMsg}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            label="Meeting Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading || isEditing}
          />
          
          <FormControl fullWidth disabled={loading || isEditing}>
            <InputLabel>Resource</InputLabel>
            <Select
              value={resourceId}
              label="Resource"
              onChange={(e) => setResourceId(e.target.value)}
            >
              {resourceData?.resources.map((res: any) => (
                <MenuItem key={res.id} value={res.id}>{res.name} (Cap: {res.capacity})</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date & Time Selection Section */}
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            {/* Left Column: Direct Typing of Times with non-editable colon separator */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              
              {/* Start Time input */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Start Time (HH : MM)</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    placeholder="HH"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    disabled={loading}
                    size="small"
                    sx={{ width: 60 }}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                  <Typography sx={{ fontWeight: 'bold' }}>:</Typography>
                  <TextField
                    placeholder="MM"
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    disabled={loading}
                    size="small"
                    sx={{ width: 60 }}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                  <FormControl size="small" sx={{ width: 80 }}>
                    <Select
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="AM">AM</MenuItem>
                      <MenuItem value="PM">PM</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* End Time input */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">End Time (HH : MM)</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    placeholder="HH"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    disabled={loading}
                    size="small"
                    sx={{ width: 60 }}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                  <Typography sx={{ fontWeight: 'bold' }}>:</Typography>
                  <TextField
                    placeholder="MM"
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    disabled={loading}
                    size="small"
                    sx={{ width: 60 }}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                  <FormControl size="small" sx={{ width: 80 }}>
                    <Select
                      value={endPeriod}
                      onChange={(e) => setEndPeriod(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="AM">AM</MenuItem>
                      <MenuItem value="PM">PM</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

            </Box>

            {/* Right Column: Calendar Date Only Selection */}
            <Box sx={{ width: '200px', display: 'flex', flexDirection: 'column', pt: 2.2 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Select Date"
                  value={selectedDate}
                  onChange={(newValue) => setSelectedDate(newValue)}
                  disabled={loading}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: '1px solid #E0E0E0' }}>
        <Button onClick={handleClose} sx={{ color: '#000' }}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading}
          sx={{ 
            backgroundColor: '#000', 
            color: '#fff',
            '&:hover': { backgroundColor: '#333' }
          }}
        >
          {loading ? 'Saving...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
