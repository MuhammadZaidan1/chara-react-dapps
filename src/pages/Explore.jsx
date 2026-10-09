import { Link } from 'react-router-dom';
import { useFactoryEvents, useEventData, useEventMetadata } from '../hooks/index.js';
import { Card, Badge } from '../components/ui/index.js';
import { formatTime, getStateLabel, getStateColor, shortAddress } from '../utils/formatters.js';

export default function Explore() {
  const { data: events, isLoading, error, refetch } = useFactoryEvents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-danger mb-4">Gagal memuat daftar acara</p>
        <button onClick={() => refetch()} className="btn btn-primary">
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-lg font-display font-bold text-text-primary">
            Explore Events
          </h1>
          <p className="text-text-secondary mt-1">
            Temukan acara menarik di Robinhood Chain Testnet
          </p>
        </div>
      </div>

      {!events?.length ? (
        <div className="card text-center py-16">
          <svg className="mx-auto h-16 w-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-4 text-heading-md text-text-primary">Belum ada acara</h3>
          <p className="mt-2 text-text-secondary">Jadilah yang pertama membuat acara melalui Organizer dashboard</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((address) => (
            <EventCardItem key={address} address={address} />
          ))}
        </div>
      )}
    </div>
  );
}

// Komponen mandiri agar data setiap event ter-fetch secara independen tanpa bergantung cache global kosong
function EventCardItem({ address }) {
  const { state: stateQuery, times: timesQuery } = useEventData(address);
  const { data: eventMetadata } = useEventMetadata(address);
  
  const state = stateQuery.data ?? 0;
  const times = timesQuery.data;

  let imageUrl = '';
  let eventName = 'Memuat Acara...';
  let location = '';
  let startTime = times?.eventStartTime;

  if (eventMetadata) {
    eventName = eventMetadata.name || 'Acara Tanpa Nama';
    location = eventMetadata.location || '';
    imageUrl = eventMetadata.image ? eventMetadata.image.replace('ipfs://', '') : '';
  }

  return (
    <Link to={`/event/${address}`} className="block">
      <Card className="overflow-hidden hover:shadow-(--shadow-modal) transition-shadow h-full flex flex-col">
        <div className="relative aspect-video overflow-hidden rounded-xl mb-4 bg-background">
          {imageUrl ? (
            <img
              src={`https://gateway.pinata.cloud/ipfs/${imageUrl}`}
              alt={eventName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary-soft flex items-center justify-center">
              <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
          <Badge variant={getStateColor(state)} className="absolute top-3 left-3 badge-brutal">
            {getStateLabel(state)}
          </Badge>
        </div>
        
        <div className="flex-1 flex flex-col">
          <h3 className="text-heading-md font-semibold text-text-primary m2b-1 line-clamp-1">
            {eventName}
          </h3>
          {location && (
            <p className="text-text-secondary text-sm mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </p>
          )}
          {startTime && (
            <p className="text-text-muted text-sm caption mb-4 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(startTime)}
            </p>
          )}
          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
            <span className="text-caption text-text-muted font-mono">
              {shortAddress(address)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}