import { Box, Typography, Paper, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

interface Resource {
  id: string;
  name: string;
  capacity: number;
}

interface Booking {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  resourceId: string;
}

interface TimelineGridProps {
  resources: Resource[];
  bookings: Booking[];
  date: dayjs.Dayjs;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

const format12HourHeader = (h: number) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH} ${period}`;
};

export default function TimelineGrid({ resources, bookings, date }: TimelineGridProps) {
  // Filter bookings for the selected date
  const todaysBookings = bookings.filter((b) => {
    const bStart = dayjs(b.startTime).tz('Asia/Kolkata');
    const startOfDay = date.startOf('day');
    const endOfDay = date.endOf('day');
    
    return b.status === 'CONFIRMED' && (
      (bStart.isAfter(startOfDay) || bStart.isSame(startOfDay)) && 
      (bStart.isBefore(endOfDay))
    );
  });

  const getLeftPercentage = (time: string) => {
    const t = dayjs(time).tz('Asia/Kolkata');
    const hours = t.hour();
    const minutes = t.minute();
    return ((hours + minutes / 60) / 24) * 100;
  };

  const getWidthPercentage = (start: string, end: string) => {
    const s = dayjs(start).tz('Asia/Kolkata');
    let e = dayjs(end).tz('Asia/Kolkata');
    
    // If end is after today, cap it at end of day
    if (e.isAfter(date.endOf('day'))) {
      e = date.endOf('day');
    }
    
    const diffMinutes = e.diff(s, 'minute');
    return (diffMinutes / (24 * 60)) * 100;
  };

  return (
    <Box sx={{ overflowX: 'auto', mt: 4 }}>
      <Box sx={{ minWidth: 800 }}>
        {/* Header Row (Hours) */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #000', pb: 1, pl: '120px' }}>
          {HOURS.map(hour => (
            <Box key={hour} sx={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#666' }}>
              {format12HourHeader(hour)}
            </Box>
          ))}
        </Box>

        {/* Resources Rows */}
        {resources.map(resource => {
          const resourceBookings = todaysBookings.filter(b => b.resourceId === resource.id);
          
          return (
            <Box key={resource.id} sx={{ display: 'flex', borderBottom: '1px solid #E0E0E0', py: 2, position: 'relative' }}>
              {/* Resource Name Sidebar */}
              <Box sx={{ width: '120px', flexShrink: 0, pr: 2, borderRight: '1px solid #E0E0E0' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{resource.name}</Typography>
                <Typography variant="caption" color="text.secondary">Cap: {resource.capacity}</Typography>
              </Box>

              {/* Timeline Container */}
              <Box sx={{ flex: 1, position: 'relative', height: '40px', backgroundColor: '#FAFAFA' }}>
                {/* Background Grid Lines */}
                {HOURS.map(hour => (
                  <Box 
                    key={`grid-${hour}`} 
                    sx={{ 
                      position: 'absolute', 
                      left: `${(hour / 24) * 100}%`, 
                      top: 0, bottom: 0, 
                      width: '1px', 
                      backgroundColor: '#F0F0F0' 
                    }} 
                  />
                ))}

                {/* Booking Blocks */}
                {resourceBookings.map(booking => {
                  const left = getLeftPercentage(booking.startTime);
                  const width = getWidthPercentage(booking.startTime, booking.endTime);
                  
                  return (
                    <Tooltip 
                      key={booking.id} 
                      title={`${booking.title} (${dayjs(booking.startTime).tz('Asia/Kolkata').format('h:mm A')} - ${dayjs(booking.endTime).tz('Asia/Kolkata').format('h:mm A')})`}
                    >
                      <Paper
                        sx={{
                          position: 'absolute',
                          left: `${left}%`,
                          width: `${width}%`,
                          top: '4px',
                          bottom: '4px',
                          backgroundColor: '#000',
                          color: '#fff',
                          borderRadius: 1,
                          overflow: 'hidden',
                          px: 1,
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#333'
                          }
                        }}
                      >
                        {width > 5 ? booking.title : ''}
                      </Paper>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}
        {resources.length === 0 && (
           <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
             No resources found.
           </Typography>
        )}
      </Box>
    </Box>
  );
}
