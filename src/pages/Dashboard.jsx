import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from '../hooks/index.js';
import { useFactoryEvents, useEventDrafts, useToast } from '../hooks/index.js';
import { Button, Card, Badge, Input, Modal, Tabs } from '../components/ui/index.js';
import { uploadToPinata, uploadJSONToPinata } from '../utils/pinata.js';
import { formatUSDG, shortAddress, parseUSDG } from '../utils/formatters.js';
import { CONTRACT_CONSTANTS } from '../config/constants.js';
import { CONTRACT_ADDRESSES, ABIS } from '../config/index.js';
import { readContract, waitForTransactionReceipt, simulateContract } from '../utils/viemHelpers.js';
import { useQueries } from '@tanstack/react-query';
import { PINATA_GATEWAY } from '../config/contracts.js';

function calculateMaxResalePrices(categories, gridData, phases) {
  const maxPrices = {};
  categories.forEach((_, catIndex) => {
    let maxPrice = 0;
    phases.forEach((_, phaseIndex) => {
      const cell = gridData[`${phaseIndex}-${catIndex}`];
      if (cell?.price) {
        const price = parseFloat(cell.price);
        if (price > maxPrice) maxPrice = price;
      }
    });
    maxPrices[catIndex] = maxPrice * 2;
  });
  return maxPrices;
}

async function fetchMetadataFromGateway(uri) {
  if (!uri) return null;
  const cid = uri.replace('ipfs://', '');
  if (!cid) return null;
  const response = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status}`);
  }
  return response.json();
}

export default function Dashboard() {
  const { walletClient, user } = useWalletClient();
  const walletAddress = user?.wallet?.address || user?.embeddedWallet?.address;
  const { data: events, refetch: refetchEvents } = useFactoryEvents();
  const { createDraft, updateDraft, getDraft } = useEventDrafts();
  const { toast } = useToast();
  
  const [activeSection, setActiveSection] = useState('builder');
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    location: '',
    flyer: null,
    flyerPreview: '',
    schedule: [{ date: '', startTime: '', endTime: '' }],
  });
  const [phases, setPhases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [gridData, setGridData] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [myEvents, setMyEvents] = useState([]);

  useEffect(() => {
    if (!events?.length || !walletAddress) {
      return;
    }
    let mounted = true;
    const fetchOrganizers = async () => {
      const ownedEvents = [];
      for (const addr of events) {
        try {
          const organizer = await readContract({ address: addr, abi: ABIS.eventTicket, functionName: 'organizer' });
          if (organizer?.toLowerCase() === walletAddress?.toLowerCase()) {
            ownedEvents.push(addr);
          }
        } catch {
          // ignore
        }
      }
      if (mounted) setMyEvents(ownedEvents);
    };
    fetchOrganizers();
    return () => { mounted = false; };
  }, [events, walletAddress]);

  const tierCount = Object.keys(gridData).length;
  const canAddMore = tierCount < CONTRACT_CONSTANTS.MAX_TIERS;

  useEffect(() => {
    let isMounted = true;

    const loadDraft = () => {
      if (editingDraftId) {
        const draft = getDraft(editingDraftId);
        if (draft && isMounted) {
          setEventData(draft.eventData || eventData);
          setPhases(draft.phases || []);
          setCategories(draft.categories || []);
          setGridData(draft.gridData || {});
          setCurrentStep(draft.currentStep || 1);
        }
      }
    };

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [editingDraftId, getDraft, eventData]);

  const handleSaveDraft = () => {
    const draft = {
      eventData,
      phases,
      categories,
      gridData,
      currentStep,
    };
    if (editingDraftId) {
      updateDraft(editingDraftId, draft);
    } else {
      const newDraft = createDraft(draft);
      setEditingDraftId(newDraft.id);
    }
    // Don't reset - keep form data visible
    // setCurrentStep(1); // Keep current step
    // resetBuilder(); // Don't clear form
  };

  const resetBuilder = () => {
    setEventData({
      name: '',
      description: '',
      location: '',
      flyer: null,
      flyerPreview: '',
      schedule: [{ date: '', startTime: '', endTime: '' }],
    });
    setPhases([]);
    setCategories([]);
    setGridData({});
  };

  const addPhase = () => {
    if (!canAddMore) return;
    setPhases([...phases, { name: '', startDate: '', endDate: '' }]);
  };

  const removePhase = (index) => {
    setPhases(phases.filter((_, i) => i !== index));
    Object.keys(gridData).forEach(key => {
      if (key.endsWith(`-${index}`)) {
        // eslint-disable-next-line no-unused-vars
        const { [key]: _, ...rest } = gridData;
        setGridData(rest);
      }
    });
  };

  const addCategory = () => {
    if (!canAddMore) return;
    setCategories([...categories, { name: '', description: '', image: null, imagePreview: '' }]);
  };

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
    Object.keys(gridData).forEach(key => {
      if (key.endsWith(`-${index}`)) {
        // eslint-disable-next-line no-unused-vars
        const { [key]: _removed, ...rest } = gridData;
        setGridData(rest);
      }
    });
  };

  const updateGridCell = (phaseIndex, categoryIndex, field, value) => {
    const key = `${phaseIndex}-${categoryIndex}`;
    setGridData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const isGridComplete = () => {
    if (!phases.length || !categories.length) return false;
    for (let p = 0; p < phases.length; p++) {
      for (let c = 0; c < categories.length; c++) {
        const cell = gridData[`${p}-${c}`];
        if (!cell || !cell.price || !cell.quota) return false;
      }
    }
    return true;
  };

  const handlePublish = async () => {
    if (!walletClient || !isGridComplete()) return;
    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    setPublishing(true);
    setShowPublishConfirm(false);
    
    try {
      // Validate phase dates before any uploads
      const now = Date.now() / 1000;
      const eventStartTime = Math.floor(new Date(`${eventData.schedule[0].date}T${eventData.schedule[0].startTime || '00:00'}`).getTime() / 1000);
      const eventEndTime = Math.floor(new Date(`${eventData.schedule[eventData.schedule.length - 1].date}T${eventData.schedule[eventData.schedule.length - 1].endTime || '23:59'}`).getTime() / 1000);
      
      if (eventStartTime >= eventEndTime) {
        throw new Error('Event start time must be before end time');
      }
      if (eventStartTime <= now) {
        throw new Error('Event start time must be in the future');
      }
      
      for (const phase of phases) {
        const phaseStart = new Date(`${phase.startDate}T${phase.startTime || '00:00'}`).getTime() / 1000;
        const phaseEnd = new Date(`${phase.endDate}T${phase.endTime || '23:59'}`).getTime() / 1000;
        
        if (phaseStart >= phaseEnd) {
          throw new Error(`Phase "${phase.name}": start time must be before end time`);
        }
        if (phaseEnd > eventStartTime) {
          throw new Error(`Phase "${phase.name}": end time must be before event start time`);
        }
        if (phaseStart <= now) {
          throw new Error(`Phase "${phase.name}": start time must be in the future`);
        }
      }

      // Upload flyer
      toast.info('Uploading event flyer...');
      const flyerCid = eventData.flyer ? await uploadToPinata(eventData.flyer) : '';
      
      // Upload category images
      toast.info('Uploading category images...');
      const categoryImages = await Promise.all(
        categories.map(async (cat) => cat.image ? await uploadToPinata(cat.image) : '')
      );
      
      // Upload category metadata
      toast.info('Uploading category metadata...');
      const categoryMetadataCids = await Promise.all(
        categories.map(async (cat, idx) => {
          const metadata = {
            name: `${cat.name} Pass - ${eventData.name}`,
            description: cat.description || `Ticket category ${cat.name} for ${eventData.name}.`,
            image: categoryImages[idx] ? `ipfs://${categoryImages[idx].replace('ipfs://', '')}` : '',
            attributes: [
              { trait_type: 'Category', value: cat.name },
              { trait_type: 'Event', value: eventData.name },
            ],
          };
          return uploadJSONToPinata(metadata);
        })
      );

      // Upload event metadata
      toast.info('Uploading event metadata...');
      const eventMetadata = {
        name: eventData.name,
        description: eventData.description,
        location: eventData.location,
        image: flyerCid ? `ipfs://${flyerCid.replace('ipfs://', '')}` : '',
        schedule: eventData.schedule.map(s => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      };
      const eventMetadataUri = await uploadJSONToPinata(eventMetadata);

      // Build tier inputs
      const tierInputs = [];
      for (let p = 0; p < phases.length; p++) {
        const phase = phases[p];
        const startTime = new Date(`${phase.startDate}T${phase.startTime || '00:00'}`).getTime() / 1000;
        const endTime = new Date(`${phase.endDate}T${phase.endTime || '23:59'}`).getTime() / 1000;
        
        for (let c = 0; c < categories.length; c++) {
          const cell = gridData[`${p}-${c}`];
          if (cell) {
            tierInputs.push({
              category: categories[c].name,
              phase: phase.name,
              price: parseUSDG(cell.price),
              maxQuota: BigInt(cell.quota),
              startTime: BigInt(Math.floor(startTime)),
              endTime: BigInt(Math.floor(endTime)),
              metadataURI: categoryMetadataCids[c],
            });
          }
        }
      }

      // Deploy contract
      toast.info('Deploying event contract...');
      const request = await simulateContract(walletClient, {
        address: CONTRACT_ADDRESSES.factory,
        abi: ABIS.factory,
        functionName: 'createEvent',
        args: [eventMetadataUri, BigInt(eventStartTime), BigInt(eventEndTime), tierInputs],
      });

      toast.info('Waiting for wallet confirmation...');
      const hash = await walletClient.writeContract(request);
      
      toast.info('Transaction submitted, waiting for confirmation...');
      const receipt = await waitForTransactionReceipt(hash);
      
      if (receipt.status === 'success') {
        toast.success('Event published successfully!');
        resetBuilder();
        await refetchEvents();
      } else {
        throw new Error('Transaction failed on-chain');
      }
    } catch (e) {
      console.error('Publish failed:', e);
      const errorMessage = e?.message || e?.error || e?.details || JSON.stringify(e);
      toast.error(`Failed to publish event: ${errorMessage}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-lg font-display font-bold text-text-primary">
            Organizer Dashboard
          </h1>
          <p className="text-text-secondary mt-1">
            Manage your events and monitor sales
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          { 
            id: 'builder', 
            label: 'Event Builder',
            content: (
              <EventBuilder
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                eventData={eventData}
                setEventData={setEventData}
                phases={phases}
                setPhases={setPhases}
                categories={categories}
                setCategories={setCategories}
                gridData={gridData}
                setGridData={setGridData}
                addPhase={addPhase}
                removePhase={removePhase}
                addCategory={addCategory}
                removeCategory={removeCategory}
                updateGridCell={updateGridCell}
                isGridComplete={isGridComplete}
                tierCount={tierCount}
                maxTiers={CONTRACT_CONSTANTS.MAX_TIERS}
                canAddMore={canAddMore}
                publishing={publishing}
                showPublishConfirm={showPublishConfirm}
                setShowPublishConfirm={setShowPublishConfirm}
                handlePublish={handlePublish}
                confirmPublish={confirmPublish}
                handleSaveDraft={handleSaveDraft}
              />
            )
          },
          { 
            id: 'my-events', 
            label: 'My Events',
            content: (
              <MyEventsSection
                events={myEvents}
                formatUSDG={formatUSDG}
                shortAddress={shortAddress}
              />
            )
          },
        ]}
        defaultTab={activeSection}
        onChange={setActiveSection}
      />
    </div>
  );
}

function EventBuilder({ 
  currentStep, setCurrentStep, eventData, setEventData, phases, setPhases,
  categories, setCategories, gridData, addPhase, removePhase,
  addCategory, removeCategory, updateGridCell, isGridComplete, tierCount,
  maxTiers, canAddMore, publishing, showPublishConfirm, setShowPublishConfirm,
  handlePublish, confirmPublish, handleSaveDraft
}) {
  const steps = [
    { num: 1, label: 'Event Details' },
    { num: 2, label: 'Phases' },
    { num: 3, label: 'Categories' },
    { num: 4, label: 'Pricing Grid' },
    { num: 5, label: 'Publish' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep >= step.num ? 'bg-primary text-white' : 'bg-border text-text-muted'
              }`}>
                {step.num}
              </div>
              {idx < steps.length - 1 && <div className={`w-16 h-1 mx-2 ${currentStep > step.num ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
        {currentStep < 5 && (
          <Button variant="secondary" onClick={handleSaveDraft}>
            Save Draft
          </Button>
        )}
      </div>

      <Card className="space-y-6">
        {currentStep === 1 && (
          <EventDetailsStep eventData={eventData} setEventData={setEventData} />
        )}
        {currentStep === 2 && (
          <PhasesStep phases={phases} setPhases={setPhases} addPhase={addPhase} removePhase={removePhase} maxTiers={maxTiers} tierCount={tierCount} categoriesCount={categories.length} canAddMore={canAddMore} />
        )}
        {currentStep === 3 && (
          <CategoriesStep categories={categories} setCategories={setCategories} addCategory={addCategory} removeCategory={removeCategory} maxTiers={maxTiers} tierCount={tierCount} phasesCount={phases.length} canAddMore={canAddMore} />
        )}
        {currentStep === 4 && (
          <GridStep 
            phases={phases} 
            categories={categories} 
            gridData={gridData} 
            updateGridCell={updateGridCell}
            tierCount={tierCount}
            maxTiers={maxTiers}
          />
        )}
        {currentStep === 5 && (
          <PublishStep 
            eventData={eventData}
            phases={phases}
            categories={categories}
            tierCount={tierCount}
            maxTiers={maxTiers}
            gridData={gridData}
            isGridComplete={isGridComplete()}
            publishing={publishing}
            showPublishConfirm={showPublishConfirm}
            setShowPublishConfirm={setShowPublishConfirm}
            handlePublish={handlePublish}
            confirmPublish={confirmPublish}
          />
        )}

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
            Previous
          </Button>
          <Button onClick={() => setCurrentStep(Math.min(5, currentStep + 1))} disabled={currentStep === 5 || publishing}>
            {currentStep === 5 ? 'Publish' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function EventDetailsStep({ eventData, setEventData }) {
  const handleFlyerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEventData(prev => ({
        ...prev,
        flyer: file,
        flyerPreview: URL.createObjectURL(file),
      }));
    }
  };

  const addScheduleDay = () => {
    setEventData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { date: '', startTime: '', endTime: '' }],
    }));
  };

  const removeScheduleDay = (index) => {
    setEventData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-heading-lg font-semibold text-text-primary">Event Details</h3>
      <Input label="Event Name" value={eventData.name} onChange={(e) => setEventData({...eventData, name: e.target.value})} placeholder="e.g., Web3 Festival 2026" />
      <Input label="Location" value={eventData.location} onChange={(e) => setEventData({...eventData, location: e.target.value})} placeholder="e.g., GBK Senayan, Jakarta" />
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
        <textarea
          value={eventData.description}
          onChange={(e) => setEventData({...eventData, description: e.target.value})}
          className="input min-h-[100px] resize-y"
          placeholder="Event description..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Flyer Image</label>
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handleFlyerChange} className="input" />
          {eventData.flyerPreview && (
            <img src={eventData.flyerPreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-border" />
          )}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-heading-md font-semibold text-text-primary">Schedule</h4>
          <Button variant="secondary" size="sm" onClick={addScheduleDay}>+ Add Day</Button>
        </div>
        {eventData.schedule.map((day, idx) => (
          <div key={idx} className="flex gap-3 items-center p-4 bg-background rounded-lg">
            <Input type="date" label="Date" value={day.date} onChange={(e) => {
              const newSchedule = [...eventData.schedule];
              newSchedule[idx] = { ...day, date: e.target.value };
              setEventData({ ...eventData, schedule: newSchedule });
            }} className="flex-1" />
            <Input type="time" label="Start" value={day.startTime} onChange={(e) => {
              const newSchedule = [...eventData.schedule];
              newSchedule[idx] = { ...day, startTime: e.target.value };
              setEventData({ ...eventData, schedule: newSchedule });
            }} className="flex-1" />
            <Input type="time" label="End" value={day.endTime} onChange={(e) => {
              const newSchedule = [...eventData.schedule];
              newSchedule[idx] = { ...day, endTime: e.target.value };
              setEventData({ ...eventData, schedule: newSchedule });
            }} className="flex-1" />
            {eventData.schedule.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeScheduleDay(idx)}>Remove</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasesStep({ phases, setPhases, addPhase, removePhase, maxTiers, tierCount, canAddMore }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-heading-lg font-semibold text-text-primary">Sale Phases</h3>
        <Button onClick={addPhase} disabled={!canAddMore}>
          + Add Phase
        </Button>
      </div>
      <p className="text-caption text-text-muted">
        {tierCount}/{maxTiers} tiers used. Each phase × category combination creates one tier.
      </p>
      {phases.map((phase, idx) => (
        <Card key={idx} className="flex items-center gap-4 p-4">
          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold">
            {idx + 1}
          </div>
          <div className="flex-1 grid gap-3 sm:grid-cols-3">
            <Input label="Phase Name" value={phase.name} onChange={(e) => setPhases(phases.map((p, i) => i === idx ? {...p, name: e.target.value} : p))} placeholder="e.g., Early Bird" />
            <Input type="date" label="Start Date" value={phase.startDate} onChange={(e) => setPhases(phases.map((p, i) => i === idx ? {...p, startDate: e.target.value} : p))} />
            <Input type="date" label="End Date" value={phase.endDate} onChange={(e) => setPhases(phases.map((p, i) => i === idx ? {...p, endDate: e.target.value} : p))} />
          </div>
          <Button variant="danger" size="sm" onClick={() => removePhase(idx)}>Remove</Button>
        </Card>
      ))}
      {!phases.length && (
        <div className="text-center py-8 text-text-muted border-2 border-dashed border-border rounded-xl">
          No phases added yet. Click "Add Phase" to create your first sale window.
        </div>
      )}
    </div>
  );
}

function CategoriesStep({ categories, setCategories, addCategory, removeCategory, maxTiers, tierCount, canAddMore }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-heading-lg font-semibold text-text-primary">Ticket Categories</h3>
        <Button onClick={addCategory} disabled={!canAddMore}>
          + Add Category
        </Button>
      </div>
      <p className="text-caption text-text-muted">
        {tierCount}/{maxTiers} tiers used. Each category × phase combination creates one tier.
      </p>
      {categories.map((cat, idx) => (
        <Card key={idx} className="flex items-center gap-4 p-4">
          <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center overflow-hidden">
            {cat.imagePreview ? (
              <img src={cat.imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 002-2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="flex-1 grid gap-3 sm:grid-cols-3">
            <Input label="Category Name" value={cat.name} onChange={(e) => setCategories(categories.map((c, i) => i === idx ? {...c, name: e.target.value} : c))} placeholder="e.g., VIP" />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1.5">Image</label>
              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setCategories(categories.map((c, i) => i === idx ? {...c, image: file, imagePreview: URL.createObjectURL(file)} : c));
                  }
                }} className="input" />
              </div>
            </div>
            <textarea
              label="Description (optional)"
              value={cat.description}
              onChange={(e) => setCategories(categories.map((c, i) => i === idx ? {...c, description: e.target.value} : c))}
              className="input min-h-[80px] resize-y sm:col-span-3"
              placeholder="Category description..."
            />
          </div>
          <Button variant="danger" size="sm" onClick={() => removeCategory(idx)}>Remove</Button>
        </Card>
      ))}
      {!categories.length && (
        <div className="text-center py-8 text-text-muted border-2 border-dashed border-border rounded-xl">
          No categories added yet. Click "Add Category" to create your first ticket type.
        </div>
      )}
    </div>
  );
}

function GridStep({ phases, categories, gridData, updateGridCell, tierCount, maxTiers }) {
  const maxResalePrices = calculateMaxResalePrices(categories, gridData, phases);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-heading-lg font-semibold text-text-primary">Pricing & Quota Grid</h3>
        <div className={`px-3 py-1 rounded-lg text-sm font-medium ${tierCount >= maxTiers ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>
          {tierCount}/{maxTiers} Tiers
        </div>
      </div>
      <p className="text-caption text-text-muted">
        Fill in price and quota for each phase × category combination. All cells are required before publishing.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-sm text-text-muted">
              <th className="pb-2 px-3 font-medium">Category / Phase</th>
              {phases.map((phase, p) => (
                <th key={p} className="pb-2 px-3 font-medium text-center">{phase.name}</th>
              ))}
              <th className="pb-2 px-3 font-medium text-center">Max Resale</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, c) => (
              <tr key={c}>
                <td className="py-3 px-3 font-medium text-text-primary">{cat.name}</td>
                {phases.map((phase, p) => {
                  const cell = gridData[`${p}-${c}`] || {};
                  const isEmpty = !cell.price || !cell.quota;
                  return (
                    <td key={p} className="py-2 px-3 text-center">
                      <div className={`grid gap-2 ${isEmpty ? 'border-2 border-dashed border-warning' : 'border border-border'} rounded-lg p-3 bg-surface`}>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                          <Input
                            type="number"
                            placeholder="Price"
                            value={cell.price || ''}
                            onChange={(e) => updateGridCell(p, c, 'price', e.target.value)}
                            className="text-center pl-6"
                          />
                        </div>
                        <Input
                          type="number"
                          placeholder="Quota"
                          value={cell.quota || ''}
                          onChange={(e) => updateGridCell(p, c, 'quota', e.target.value)}
                          className="text-center"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-center">
                  <div className="bg-background border border-border rounded-lg p-3 text-center">
                    <span className="text-sm font-medium text-text-secondary flex items-center justify-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      ${formatUSDG(BigInt(maxResalePrices[c]) * 1000000n)} mUSDG
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!phases.length || !categories.length ? (
        <p className="text-center text-text-muted py-8">
          Add phases and categories first to see the grid.
        </p>
      ) : (
        <p className="text-center text-caption text-text-muted">
          {Object.keys(gridData).filter(k => gridData[k].price && gridData[k].quota).length}/{tierCount} cells filled
        </p>
      )}
    </div>
  );
}

function PublishStep({ 
  eventData, phases, categories, tierCount, maxTiers, gridData,
  isGridComplete, publishing, showPublishConfirm, setShowPublishConfirm,
  handlePublish, confirmPublish
}) {
  const maxResalePrices = calculateMaxResalePrices(categories, gridData, phases);

  return (
    <div className="space-y-6">
      <div className="bg-warning-soft border border-warning rounded-lg p-6">
        <h3 className="text-heading-md font-semibold text-warning mb-2">⚠️ Final Confirmation</h3>
        <p className="text-text-secondary">
          Once published, all event data (prices, quotas, times, categories) becomes <strong>immutable on-chain</strong> and cannot be changed.
        </p>
        <ul className="mt-4 space-y-2 text-text-secondary">
          <li>• {tierCount} tiers will be created</li>
          <li>• {categories.length} categories × {phases.length} phases</li>
          <li>• Event: {eventData.name} at {eventData.location}</li>
          <li>• Sale starts: {eventData.schedule[0]?.date} {eventData.schedule[0]?.startTime}</li>
          <li>• Event ends: {eventData.schedule[eventData.schedule.length - 1]?.date} {eventData.schedule[eventData.schedule.length - 1]?.endTime}</li>
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h4 className="text-heading-md font-semibold mb-3">Event Summary</h4>
          <p><strong>Name:</strong> {eventData.name}</p>
          <p><strong>Location:</strong> {eventData.location}</p>
          <p><strong>Description:</strong> {eventData.description || 'None'}</p>
        </Card>
        <Card>
          <h4 className="text-heading-md font-semibold mb-3">Tier Summary</h4>
          <p><strong>Categories:</strong> {categories.map(c => c.name).join(', ')}</p>
          <p><strong>Phases:</strong> {phases.map(p => p.name).join(', ')}</p>
          <p><strong>Total Tiers:</strong> {tierCount}/{maxTiers}</p>
          <div className="mt-3 space-y-1">
            <p className="text-caption font-medium text-text-primary">Max Resale Prices (2× highest per category):</p>
            {categories.map((cat, c) => (
              <p key={c} className="text-caption text-text-secondary flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 002-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {cat.name}: ${formatUSDG(BigInt(maxResalePrices[c]) * 1000000n)} mUSDG
              </p>
            ))}
          </div>
        </Card>
      </div>

      {showPublishConfirm ? (
        <Modal isOpen={true} onClose={() => setShowPublishConfirm(false)} title="Confirm Publish" size="md">
          <p className="text-text-secondary mb-6">
            This will deploy a new smart contract on Robinhood Chain Testnet. 
            You will need to confirm the transaction in your wallet.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
            <Button onClick={confirmPublish} disabled={publishing} loading={publishing}>
              Confirm & Publish
            </Button>
          </div>
        </Modal>
      ) : (
        <Button 
          onClick={handlePublish} 
          disabled={!isGridComplete || publishing}
          size="lg"
          className="w-full"
        >
          {publishing ? 'Publishing...' : 'Publish Event'}
        </Button>
      )}
    </div>
  );
}

function MyEventsSection({ events, shortAddress }) {
  const navigate = useNavigate();

  const metadataQueries = useQueries({
    queries: events?.map(addr => ({
      queryKey: ['event', addr, 'metadataParsed'],
      queryFn: async () => {
        const uri = await readContract({ address: addr, abi: ABIS.eventTicket, functionName: 'eventMetadataURI' });
        return fetchMetadataFromGateway(uri);
      },
      enabled: !!addr,
      staleTime: 60000,
    })) || [],
  });

  return (
    <div className="space-y-8">
      <h2 className="text-heading-lg font-semibold text-text-primary">My Events</h2>
      
      {!events?.length ? (
        <Card className="text-center py-12">
          <p className="text-text-secondary">No events created yet</p>
          <p className="text-caption text-text-muted mt-1">Create your first event in the Event Builder tab</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((address, idx) => {
            const metadata = metadataQueries[idx]?.data;
            const scheduleStr = metadata?.schedule?.map(s => s.date).join(' - ') || 'No schedule';
            const imageUrl = metadata?.image ? metadata.image.replace('ipfs://', '') : null;

            return (
              <Card 
                key={address} 
                className="hover:shadow-[var(--shadow-modal)] transition-shadow cursor-pointer"
                onClick={() => navigate(`/organizer/event/${address}`)}
              >
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2 flex-wrap">
                      {imageUrl && (
                        <img 
                          src={`https://gateway.pinata.cloud/ipfs/${imageUrl}`} 
                          alt={metadata?.name || 'Event'}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-heading-md font-semibold text-text-primary truncate">
                            {metadata?.name || 'Unknown Event'}
                          </h3>
                          <Badge variant="default">View Details</Badge>
                        </div>
                        {metadata?.location && (
                          <p className="text-text-secondary text-sm mb-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {metadata.location}
                          </p>
                        )}
                        {scheduleStr !== 'No schedule' && (
                          <p className="text-text-muted text-sm mb-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {scheduleStr}
                          </p>
                        )}
                        <p className="text-caption text-text-muted font-mono">{shortAddress(address)}</p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/organizer/event/${address}`); }}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}