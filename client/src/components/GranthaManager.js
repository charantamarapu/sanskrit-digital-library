import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './GranthaManager.css';

function GranthaManager() {
    const [granthas, setGranthas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingGrantha, setEditingGrantha] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        title: '',
        titleEnglish: '',
        author: '',
        authorEnglish: '',
        description: '',
        language: 'Sanskrit',
        category: '',
        status: 'draft',
        chapterLabel: 'अध्यायः',
        verseLabel: 'श्लोकः',
        chapterLabelEnglish: 'Chapter',
        verseLabelEnglish: 'Verse',
        availableCommentaries: []
    });

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        if (!adminId) {
            navigate('/admin/login');
            return;
        }
        fetchGranthas();
    }, [navigate]);

    const fetchGranthas = async () => {
        try {
            const response = await axios.get(`${config.API_URL}/api/admin/granthas`);
            const granthaData = Array.isArray(response.data) ? response.data : (response.data?.granthas || []);
            setGranthas(granthaData);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch granthas:', error);
            setGranthas([]);
            setLoading(false);
        }
    };

    const handleEdit = (grantha) => {
        setEditingGrantha(grantha);
        setFormData({
            title: grantha.title || '',
            titleEnglish: grantha.titleEnglish || '',
            author: grantha.author || '',
            authorEnglish: grantha.authorEnglish || '',
            description: grantha.description || '',
            language: grantha.language || 'Sanskrit',
            category: grantha.category || '',
            status: grantha.status || 'draft',
            chapterLabel: grantha.chapterLabel || 'अध्यायः',
            verseLabel: grantha.verseLabel || 'श्लोकः',
            chapterLabelEnglish: grantha.chapterLabelEnglish || 'Chapter',
            verseLabelEnglish: grantha.verseLabelEnglish || 'Verse',
            availableCommentaries: grantha.availableCommentaries || []
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this grantha? All verses and commentaries will be deleted.')) {
            return;
        }

        try {
            await axios.delete(`${config.API_URL}/api/granthas/${id}`);
            alert('✅ Grantha deleted successfully!');
            fetchGranthas();
        } catch (error) {
            console.error('Failed to delete grantha:', error);
            alert('❌ Failed to delete grantha');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingGrantha) {
                await axios.put(`${config.API_URL}/api/granthas/${editingGrantha._id}`, formData);
                alert('✅ Grantha updated successfully!');
            } else {
                await axios.post(`${config.API_URL}/api/granthas`, formData);
                alert('✅ Grantha created successfully!');
            }

            setShowForm(false);
            setEditingGrantha(null);
            resetForm();
            fetchGranthas();
        } catch (error) {
            console.error('Failed to save grantha:', error);
            alert('❌ Failed to save grantha');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            titleEnglish: '',
            author: '',
            authorEnglish: '',
            description: '',
            language: 'Sanskrit',
            category: '',
            status: 'draft',
            chapterLabel: 'अध्यायः',
            verseLabel: 'श्लोकः',
            chapterLabelEnglish: 'Chapter',
            verseLabelEnglish: 'Verse',
            availableCommentaries: []
        });
        setEditingGrantha(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingGrantha(null);
        resetForm();
    };

    // Commentary management functions
    const addCommentary = () => {
        setFormData({
            ...formData,
            availableCommentaries: [
                ...formData.availableCommentaries,
                { name: '', author: '', order: formData.availableCommentaries.length }
            ]
        });
    };

    const removeCommentary = (index) => {
        const newCommentaries = formData.availableCommentaries.filter((_, i) => i !== index);
        // Reorder after removal
        newCommentaries.forEach((com, idx) => {
            com.order = idx;
        });
        setFormData({
            ...formData,
            availableCommentaries: newCommentaries
        });
    };

    const updateCommentary = (index, field, value) => {
        const newCommentaries = [...formData.availableCommentaries];
        newCommentaries[index] = {
            ...newCommentaries[index],
            [field]: value
        };
        setFormData({
            ...formData,
            availableCommentaries: newCommentaries
        });
    };

    const moveCommentaryUp = (index) => {
        if (index === 0) return;
        const newCommentaries = [...formData.availableCommentaries];
        [newCommentaries[index - 1], newCommentaries[index]] = [newCommentaries[index], newCommentaries[index - 1]];
        // Update order numbers
        newCommentaries.forEach((com, idx) => {
            com.order = idx;
        });
        setFormData({
            ...formData,
            availableCommentaries: newCommentaries
        });
    };

    const moveCommentaryDown = (index) => {
        if (index === formData.availableCommentaries.length - 1) return;
        const newCommentaries = [...formData.availableCommentaries];
        [newCommentaries[index], newCommentaries[index + 1]] = [newCommentaries[index + 1], newCommentaries[index]];
        // Update order numbers
        newCommentaries.forEach((com, idx) => {
            com.order = idx;
        });
        setFormData({
            ...formData,
            availableCommentaries: newCommentaries
        });
    };

    // NEW: Export Grantha Function
    const handleExportGrantha = async (granthaId) => {
        try {
            const response = await axios.get(`${config.API_URL}/api/granthas/${granthaId}/export`, {
                responseType: 'blob'
            });

            // Create a download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Find grantha name for filename
            const grantha = granthas.find(g => g._id === granthaId);
            const filename = `${grantha?.titleEnglish || grantha?.title || 'grantha'}_export.json`;

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            alert('✅ Grantha exported successfully!');
        } catch (error) {
            console.error('Failed to export grantha:', error);
            alert('❌ Failed to export grantha');
        }
    };

    // NEW: Import Grantha Function
    const handleImportGrantha = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            alert('❌ Please select a valid JSON file');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('granthaFile', file);

            const response = await axios.post(`${config.API_URL}/api/granthas/import`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert(`✅ Grantha imported successfully! ${response.data.message || ''}`);
            fetchGranthas();

            // Reset file input
            event.target.value = '';
        } catch (error) {
            console.error('Failed to import grantha:', error);
            alert(`❌ Failed to import grantha: ${error.response?.data?.message || error.message}`);
            event.target.value = '';
        }
    };

    if (loading) {
        return <div className="loading">Loading granthas...</div>;
    }

    return (
        <div className="grantha-manager">
            <header className="manager-header">
                <h1>📚 Grantha Manager</h1>
                <div className="header-actions">
                    <Link to="/" className="btn-home-icon" title="Home">🏠</Link>
                    <Link to="/admin/dashboard" className="btn-nav">Dashboard</Link>
                    <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
                        + Add Grantha
                    </button>
                    <label className="btn-import">
                        📥 Import Grantha
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImportGrantha}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </header>

            {showForm && (
                <div className="grantha-form-container">
                    <div className="form-header">
                        <h2>{editingGrantha ? 'Edit Grantha' : 'Add New Grantha'}</h2>
                        <button className="btn-close" onClick={handleCancel}>✕</button>
                    </div>

                    <form className="grantha-form" onSubmit={handleSubmit}>
                        <div className="section-header">
                            <h3>📝 Basic Information</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Title (Sanskrit) *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="श्रीमद्भगवद्गीता"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Title (English)</label>
                                <input
                                    type="text"
                                    value={formData.titleEnglish}
                                    onChange={(e) => setFormData({ ...formData, titleEnglish: e.target.value })}
                                    placeholder="Grantha Name"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Author (Sanskrit)</label>
                                <input
                                    type="text"
                                    value={formData.author}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    placeholder="व्यासः"
                                />
                            </div>

                            <div className="form-group">
                                <label>Author (English)</label>
                                <input
                                    type="text"
                                    value={formData.authorEnglish}
                                    onChange={(e) => setFormData({ ...formData, authorEnglish: e.target.value })}
                                    placeholder="Author Name"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of the grantha..."
                                rows="4"
                            />
                        </div>

                        <div className="form-row-3">
                            <div className="form-group">
                                <label>Language</label>
                                <select
                                    value={formData.language}
                                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                >
                                    <option value="Sanskrit">Sanskrit</option>
                                    <option value="Vedic Sanskrit">Vedic Sanskrit</option>
                                    <option value="Prakrit">Prakrit</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="">Select Category</option>
                                    <option value="Veda">Veda</option>
                                    <option value="Upanishad">Upanishad</option>
                                    <option value="Purana">Purana</option>
                                    <option value="Philosophical">Philosophical</option>
                                    <option value="Stotra">Stotra</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                            </div>
                        </div>

                        <div className="section-header">
                            <h3>🏷️ Custom Labels</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Chapter Label (Sanskrit)</label>
                                <input
                                    type="text"
                                    value={formData.chapterLabel}
                                    onChange={(e) => setFormData({ ...formData, chapterLabel: e.target.value })}
                                    placeholder="अध्यायः"
                                />
                                <small className="field-hint">e.g., अध्यायः, काण्डः, प्रश्नः, पटलः</small>
                            </div>

                            <div className="form-group">
                                <label>Chapter Label (English)</label>
                                <input
                                    type="text"
                                    value={formData.chapterLabelEnglish}
                                    onChange={(e) => setFormData({ ...formData, chapterLabelEnglish: e.target.value })}
                                    placeholder="Chapter / Kanda / Section"
                                />
                                <small className="field-hint">e.g., Chapter, Kanda, Section</small>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Verse Label (Sanskrit)</label>
                                <input
                                    type="text"
                                    value={formData.verseLabel}
                                    onChange={(e) => setFormData({ ...formData, verseLabel: e.target.value })}
                                    placeholder="श्लोकः"
                                />
                                <small className="field-hint">e.g., श्लोकः, मन्त्रः, सूत्रम्, गाथा</small>
                            </div>

                            <div className="form-group">
                                <label>Verse Label (English)</label>
                                <input
                                    type="text"
                                    value={formData.verseLabelEnglish}
                                    onChange={(e) => setFormData({ ...formData, verseLabelEnglish: e.target.value })}
                                    placeholder="Verse / Mantra / Hymn"
                                />
                                <small className="field-hint">e.g., Verse, Mantra, Hymn, Stanza</small>
                            </div>
                        </div>

                        <div className="section-header">
                            <h3>💬 Available Commentaries</h3>
                            <button type="button" className="btn-add-commentary" onClick={addCommentary}>
                                + Add Commentary
                            </button>
                        </div>

                        <div className="commentaries-list-form">
                            {formData.availableCommentaries.length === 0 ? (
                                <p className="no-commentaries-msg">No commentaries defined. Add commentaries that will be available for this grantha.</p>
                            ) : (
                                formData.availableCommentaries.map((com, index) => (
                                    <div key={index} className="commentary-definition-item">
                                        <div className="commentary-order-controls">
                                            <span className="order-number">{index + 1}</span>
                                            <div className="order-buttons">
                                                <button
                                                    type="button"
                                                    onClick={() => moveCommentaryUp(index)}
                                                    disabled={index === 0}
                                                    className="btn-order"
                                                    title="Move up"
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCommentaryDown(index)}
                                                    disabled={index === formData.availableCommentaries.length - 1}
                                                    className="btn-order"
                                                    title="Move down"
                                                >
                                                    ↓
                                                </button>
                                            </div>
                                        </div>

                                        <div className="commentary-definition-fields">
                                            <div className="form-group">
                                                <label>Commentary Name *</label>
                                                <input
                                                    type="text"
                                                    value={com.name}
                                                    onChange={(e) => updateCommentary(index, 'name', e.target.value)}
                                                    placeholder="भाष्यम्"
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Author</label>
                                                <input
                                                    type="text"
                                                    value={com.author}
                                                    onChange={(e) => updateCommentary(index, 'author', e.target.value)}
                                                    placeholder="शङ्कराचार्यः"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeCommentary(index)}
                                            className="btn-remove-commentary-def"
                                            title="Remove commentary"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-save">
                                {editingGrantha ? 'Update' : 'Save'} Grantha
                            </button>
                            <button type="button" className="btn-cancel" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="granthas-list">
                <h2>All Granthas</h2>
                {!Array.isArray(granthas) || granthas.length === 0 ? (
                    <div className="no-granthas">No granthas found. Add your first grantha!</div>
                ) : (
                    <div className="granthas-grid">
                        {granthas.map((grantha) => (
                            <div key={grantha._id} className="grantha-card">
                                <h3>{grantha.title}</h3>
                                {grantha.author && <p className="author">by {grantha.author}</p>}
                                <span className={`status-badge ${grantha.status}`}>{grantha.status}</span>

                                <div className="grantha-labels">
                                    <span className="label-badge">{grantha.chapterLabel}</span>
                                    <span className="label-badge">{grantha.verseLabel}</span>
                                </div>

                                {grantha.availableCommentaries && grantha.availableCommentaries.length > 0 && (
                                    <div className="commentaries-count">
                                        {grantha.availableCommentaries.length} commentaries defined
                                    </div>
                                )}

                                {grantha.createdAt && (
                                    <p className="date">Created: {new Date(grantha.createdAt).toLocaleDateString()}</p>
                                )}

                                <div className="card-actions">
                                    <button className="btn-export" onClick={() => handleExportGrantha(grantha._id)}>
                                        📤 Export
                                    </button>
                                    <button className="btn-edit" onClick={() => handleEdit(grantha)}>
                                        ✏️ Edit
                                    </button>
                                    <button className="btn-delete" onClick={() => handleDelete(grantha._id)}>
                                        🗑️ Delete
                                    </button>
                                    <Link to={`/grantha/${grantha._id}`} className="btn-view">
                                        👁️ View
                                    </Link>
                                    <Link to={`/admin/verses/${grantha._id}`} className="btn-verses">
                                        📝 Verses
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GranthaManager;
