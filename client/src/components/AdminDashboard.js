import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './AdminDashboard.css';

function AdminDashboard() {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState([]);
    const [granthas, setGranthas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        if (!adminId) {
            navigate('/admin/login');
            return;
        }
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        try {
            const [suggestionsRes, granthasRes] = await Promise.all([
                axios.get(`${config.API_URL}/api/suggestions/pending`),
                axios.get(`${config.API_URL}/api/admin/granthas`)
            ]);

            const suggestionsData = Array.isArray(suggestionsRes.data)
                ? suggestionsRes.data
                : (suggestionsRes.data?.suggestions || []);

            const granthasData = Array.isArray(granthasRes.data)
                ? granthasRes.data
                : (granthasRes.data?.granthas || []);

            setSuggestions(suggestionsData);
            setGranthas(granthasData);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setSuggestions([]);
            setGranthas([]);
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.put(`${config.API_URL}/api/suggestions/${id}/approve`);
            alert('✅ Suggestion approved!');
            fetchData();
        } catch (error) {
            console.error('Failed to approve suggestion:', error);
            alert('❌ Failed to approve suggestion');
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Are you sure you want to reject this suggestion?')) {
            return;
        }

        try {
            await axios.put(`${config.API_URL}/api/suggestions/${id}/reject`);
            alert('✅ Suggestion rejected!');
            fetchData();
        } catch (error) {
            console.error('Failed to reject suggestion:', error);
            alert('❌ Failed to reject suggestion');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminId');
        navigate('/admin/login');
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    return (
        <div className="admin-dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Admin Dashboard</h1>
                    <p className="subtitle">Sanskrit Digital Library Management</p>
                </div>
                <div className="header-actions">
                    <Link to="/" className="btn-home">🏠 Home</Link>
                    <button onClick={handleLogout} className="btn-logout">🚪 Logout</button>
                </div>
            </header>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <div className="stat-icon">📚</div>
                    <div className="stat-info">
                        <h3>{granthas.length}</h3>
                        <p>Total Granthas</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-info">
                        <h3>{suggestions.length}</h3>
                        <p>Pending Suggestions</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-info">
                        <h3>{granthas.filter(g => g.status === 'published').length}</h3>
                        <p>Published</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-info">
                        <h3>{granthas.filter(g => g.status === 'draft').length}</h3>
                        <p>Drafts</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="card-icon">📚</div>
                    <h3>Manage Granthas</h3>
                    <p>Add, edit, or delete granthas and their metadata</p>
                    <Link to="/admin/granthas" className="btn-action">
                        Open Grantha Manager
                    </Link>
                </div>

                <div className="dashboard-card">
                    <div className="card-icon">📝</div>
                    <h3>Quick Access</h3>
                    <p>Manage verses and commentaries for each grantha</p>
                    {granthas.length === 0 ? (
                        <p className="no-data">No granthas available. Create one first!</p>
                    ) : (
                        <div className="grantha-links">
                            {granthas.slice(0, 5).map(grantha => (
                                <Link
                                    key={grantha._id}
                                    to={`/admin/verses/${grantha._id}`}
                                    className="grantha-link"
                                >
                                    📖 {grantha.title}
                                </Link>
                            ))}
                            {granthas.length > 5 && (
                                <Link to="/admin/granthas" className="view-all-link">
                                    View all granthas →
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                <div className="dashboard-card">
                    <div className="card-icon">💬</div>
                    <h3>User Suggestions</h3>
                    <p>Review and manage user-submitted suggestions</p>
                    <div className="suggestion-count">
                        {suggestions.length === 0 ? (
                            <p className="no-data">No pending suggestions</p>
                        ) : (
                            <p className="pending-count">{suggestions.length} pending review</p>
                        )}
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="card-icon">🔍</div>
                    <h3>Browse Library</h3>
                    <p>View the public-facing website</p>
                    <Link to="/granthas" className="btn-action">
                        Browse Granthas
                    </Link>
                </div>
            </div>

            {suggestions.length > 0 && (
                <div className="suggestions-section">
                    <h2>
                        <span className="section-icon">💬</span>
                        Pending Suggestions ({suggestions.length})
                    </h2>

                    <div className="suggestions-list">
                        {suggestions.map(suggestion => (
                            <div key={suggestion._id} className="suggestion-card">
                                <div className="suggestion-header">
                                    <div className="suggestion-meta">
                                        <span className="suggestion-type">
                                            {suggestion.suggestionType === 'moolam' ? '📖 Verse' : '💬 Commentary'}
                                        </span>
                                        <span className="suggestion-date">
                                            {new Date(suggestion.createdAt).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <span className="suggestion-author">
                                        👤 {suggestion.submittedBy || 'Anonymous'}
                                    </span>
                                </div>

                                <div className="suggestion-content">
                                    <div className="suggestion-section">
                                        <h4>Original Text:</h4>
                                        <p className="original-text">{suggestion.originalText}</p>
                                    </div>

                                    <div className="suggestion-arrow">→</div>

                                    <div className="suggestion-section">
                                        <h4>Suggested Text:</h4>
                                        <p className="suggested-text">{suggestion.suggestedText}</p>
                                    </div>
                                </div>

                                {suggestion.reason && (
                                    <div className="suggestion-reason">
                                        <strong>Reason:</strong> {suggestion.reason}
                                    </div>
                                )}

                                <div className="suggestion-actions">
                                    <button
                                        className="btn-approve"
                                        onClick={() => handleApprove(suggestion._id)}
                                    >
                                        ✅ Approve
                                    </button>
                                    <button
                                        className="btn-reject"
                                        onClick={() => handleReject(suggestion._id)}
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
