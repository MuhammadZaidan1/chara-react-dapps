import { Routes, Route } from 'react-router-dom';
import PageWrapper from './components/layout/PageWrapper.jsx';
import Explore from './pages/Explore.jsx';
import EventDetail from './pages/EventDetail.jsx';
import OrganizerEventDetail from './pages/OrganizerEventDetail.jsx';
import MyTickets from './pages/MyTickets.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Docs from './pages/Docs.jsx';
import GetStarted from './pages/GetStarted.jsx';
import TicketDetail from './pages/TicketDetail.jsx';
import GateScannerPage from './pages/GateScannerPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PageWrapper />}>
        <Route path="/explore" element={<Explore />} />
        <Route path="/event/:address" element={<EventDetail />} />
        <Route path="/organizer/event/:address" element={<OrganizerEventDetail />} />
        <Route path="/scanner/:eventAddress" element={<GateScannerPage />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/ticket/:eventAddress/:tokenId" element={<TicketDetail />} />
        <Route path="/" element={<Explore />} />
      </Route>
    </Routes>
  );
}