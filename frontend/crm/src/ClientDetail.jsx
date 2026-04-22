// frontend/src/ClientDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ClientDetail() {
  const { id } = useParams(); // Gets the client ID from the URL
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  
  // Form state for a new deal
  const [formData, setFormData] = useState({
    serviceType: 'Property Buying',
    propertyDetails: '',
    notes: ''
  });

  const userInfo = JSON.parse(localStorage.getItem('userInfo'));
  const config = { headers: { Authorization: `Bearer ${userInfo?.token}` } };

  // Fetch the Client and their specific Services
  const fetchData = async () => {
    try {
      const clientRes = await axios.get(`http://localhost:5000/api/clients/${id}`, config);
      setClient(clientRes.data);

      const servicesRes = await axios.get(`http://localhost:5000/api/services/client/${id}`, config);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/services', { ...formData, client: id }, config);
      setFormData({ serviceType: 'Property Buying', propertyDetails: '', notes: '' });
      fetchData(); // Refresh the deals list
    } catch (error) {
      alert('Failed to add service.');
    }
  };

  if (!client) return <div className="p-8 text-center text-gray-500">Loading client profile...</div>;

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto font-sans">
      <button onClick={() => navigate('/')} className="mb-6 text-blue-600 hover:underline flex items-center gap-2">
        ← Back to Dashboard
      </button>

      {/* Client Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h1 className="text-3xl font-bold text-gray-800">{client.name}</h1>
        <p className="text-gray-500 mt-1">{client.email} | {client.phone || 'No Phone'}</p>
        <p className="text-xs text-gray-400 mt-4">Profile created by {client.createdBy?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Add New Service Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Start New Deal</h2>
          <form onSubmit={handleServiceSubmit} className="flex flex-col gap-4">
            <select 
              value={formData.serviceType} 
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Property Buying">Property Buying</option>
              <option value="Property Selling">Property Selling</option>
              <option value="Legal/Consultation">Legal/Consultation</option>
              <option value="Property Management">Property Management</option>
              <option value="Interior Design">Interior Design</option>
            </select>
            <input 
              type="text" placeholder="Property Details (e.g., 3BHK Indiranagar)" 
              value={formData.propertyDetails} 
              onChange={(e) => setFormData({ ...formData, propertyDetails: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea 
              placeholder="Initial Notes..." 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
            />
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Add Service
            </button>
          </form>
        </div>

        {/* Right: Active Services/Deals List */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Active Services</h2>
          {services.length === 0 ? (
            <p className="text-gray-500 italic">No active deals for this client.</p>
          ) : (
            <ul className="space-y-4">
              {services.map((svc) => (
                <li key={svc._id} className="p-4 border border-gray-100 rounded-lg bg-gray-50 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800">{svc.serviceType}</h3>
                    <p className="text-sm text-gray-600 mt-1">{svc.propertyDetails || 'No property specified'}</p>
                    {svc.notes && <p className="text-sm text-gray-500 italic mt-2">"{svc.notes}"</p>}
                    <p className="text-xs text-gray-400 mt-3">Agent: {svc.assignedAgent?.name}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                    {svc.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientDetail;