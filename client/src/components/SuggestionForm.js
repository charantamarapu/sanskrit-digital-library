import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './SuggestionForm.css';

function SuggestionForm({ theme, setTheme }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [grantha, setGrantha] = useState(null);
    const [verses, setVerses] = useState([]);
    const [selectedChapter, setSelectedChapter] = useState('');
    const [selectedVerse, setSelectedVerse] = useState('');
    const [suggestionType, setSuggestionType] = useState('moolam');
    const [originalText, setOriginalText] = useState('');
    const [suggestedText, setSuggestedText] = useState('');
    const [reason, setReason] = useState('');
    const [submittedBy, setSubmittedBy] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const granthaRes = await axios.get(`${config.API_URL}/api/granthas/${id}`);
            const versesRes = await axios.get(`${config.API_URL}/api/verses/grantha/${id}`);

            setGrantha(granthaRes.data);
            setVerses(versesRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    };

    // Get unique chapters
    const chapters = [...new Set(verses.map(v => v.chapterNumber))].sort((a, b) => a - b);

    // Get verses for selected chapter
    const chapterVerses = verses.filter(v => v.chapterNumber === Number(selectedChapter));

    // Get selected verse object
    const selectedVerseObj = verses.find(v => v._id === selectedVerse);

    useEffect(() => {
        if (selectedVerseObj) {
            if (suggestionType === 'moolam') {
                setOriginalText(selectedVerseObj.verseText);
            } else {
                setOriginalText('');
            }
        }
    }, [selectedVerse, suggestionType, selectedVerseObj]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedVerse) {
            alert('Please select a verse');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                granthaId: id,
                verseId: selectedVerse,
                suggestionType,
                originalText,
                suggestedText,
                reason,
                submittedBy: submittedBy || 'Anonymous'
            };

            await axios.post(`${config.API_URL}/api/suggestions`, payload);

            alert('✅ Suggestion submitted successfully! Thank you for your contribution.');

            // Reset form
            setSelectedChapter('');
            setSelectedVerse('');
            setSuggestionType('moolam');
            setOriginalText('');
            setSuggestedText('');
            setReason('');
            setSubmittedBy('');
            setSubmitting(false);
        } catch (error) {
            console.error('Failed to submit suggestion:', error);
            alert('❌ Failed to submit suggestion. Please try again.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!grantha) {
        return (
            <div className="error-container">
                <h2>Grantha not found</h2>
                <Link to="/granthas" className="btn-primary">Back to List</Link>
            </div>
        );
    }

    return (
        <div className="suggestion-form-page">
            <header className="form-page-header">
                <div className="header-content">
                    <Link to={`/grantha/${id}`} className="btn-back">
                        ← Back to Grantha
                    </Link>
                    <div className="theme-selector">
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="theme-select"
                        >
                            <option value="light">☀️ Light</option>
                            <option value="sepia">📜 Sepia</option>
                            <option value="dark">🌙 Dark</option>
                        </select>
                    </div>
                </div>
                <div className="header-title">
                    <h1>Suggest Edit</h1>
                    <p className="grantha-title">{grantha.title}</p>
                </div>
            </header>

            <div className="suggestion-form-container">
                <div className="form-intro">
                    <h2>📝 Help Improve This Grantha</h2>
                    <p>Found an error or have a suggestion? Submit your correction here. Our team will review it carefully.</p>
                </div>

                <form onSubmit={handleSubmit} className="suggestion-form">
                    <div className="form-section">
                        <h3>📍 Select Location</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{grantha.chapterLabel || 'अध्यायः'} *</label>
                                <select
                                    value={selectedChapter}
                                    onChange={(e) => {
                                        setSelectedChapter(e.target.value);
                                        setSelectedVerse('');
                                    }}
                                    required
                                >
                                    <option value="">Select {grantha.chapterLabelEnglish || 'Chapter'}</option>
                                    {chapters.map(ch => (
                                        <option key={ch} value={ch}>
                                            {grantha.chapterLabel || 'अध्यायः'} {ch}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{grantha.verseLabel || 'श्लोकः'} *</label>
                                <select
                                    value={selectedVerse}
                                    onChange={(e) => setSelectedVerse(e.target.value)}
                                    disabled={!selectedChapter}
                                    required
                                >
                                    <option value="">Select {grantha.verseLabelEnglish || 'Verse'}</option>
                                    {chapterVerses.map(v => (
                                        <option key={v._id} value={v._id}>
                                            {grantha.verseLabel || 'श्लोकः'} {v.verseNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>🎯 Suggestion Type</h3>

                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="suggestionType"
                                    value="moolam"
                                    checked={suggestionType === 'moolam'}
                                    onChange={(e) => setSuggestionType(e.target.value)}
                                />
                                <span className="radio-text">
                                    <strong>Moolam (मूलम्)</strong> - Original verse text correction
                                </span>
                            </label>

                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="suggestionType"
                                    value="commentary"
                                    checked={suggestionType === 'commentary'}
                                    onChange={(e) => setSuggestionType(e.target.value)}
                                />
                                <span className="radio-text">
                                    <strong>Commentary (भाष्यम्)</strong> - Commentary text correction
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>✏️ Your Suggestion</h3>

                        {selectedVerseObj && (
                            <div className="current-verse-display">
                                <h4>
                                    Current Text - {grantha.chapterLabel || 'अध्यायः'} {selectedVerseObj.chapterNumber}, {grantha.verseLabel || 'श्लोकः'} {selectedVerseObj.verseNumber}
                                </h4>
                                <div className="verse-display-box">
                                    {selectedVerseObj.verseText}
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Original Text (Current) *</label>
                            <textarea
                                value={originalText}
                                onChange={(e) => setOriginalText(e.target.value)}
                                placeholder="Enter the current text that needs correction..."
                                rows="5"
                                required
                            />
                            <small className="field-hint">
                                Copy the exact text you want to change
                            </small>
                        </div>

                        <div className="suggestion-arrow">→</div>

                        <div className="form-group">
                            <label>Suggested Text (Corrected) *</label>
                            <textarea
                                value={suggestedText}
                                onChange={(e) => setSuggestedText(e.target.value)}
                                placeholder="Enter your corrected version..."
                                rows="5"
                                required
                            />
                            <small className="field-hint">
                                Enter the corrected text as it should appear
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Reason for Change *</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Explain why this change is needed (e.g., spelling error, missing word, wrong reference, etc.)"
                                rows="4"
                                required
                            />
                            <small className="field-hint">
                                Help us understand your correction
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Your Name (Optional)</label>
                            <input
                                type="text"
                                value={submittedBy}
                                onChange={(e) => setSubmittedBy(e.target.value)}
                                placeholder="Your name (or leave blank for anonymous)"
                            />
                            <small className="field-hint">
                                Your name will be visible to admins only
                            </small>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={submitting}
                        >
                            {submitting ? '⏳ Submitting...' : '✅ Submit Suggestion'}
                        </button>
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => navigate(`/grantha/${id}`)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            <div className="suggestion-guidelines">
                <h3>📋 Guidelines</h3>
                <ul>
                    <li>✅ Be specific about what needs to be changed</li>
                    <li>✅ Provide accurate corrections with proper Sanskrit spelling</li>
                    <li>✅ Explain your reasoning clearly</li>
                    <li>✅ Only suggest one change per submission</li>
                    <li>❌ Don't submit interpretations or personal opinions</li>
                    <li>❌ Don't submit suggestions for formatting or style</li>
                </ul>
                <p className="note">
                    <strong>Note:</strong> All suggestions will be reviewed by our team of Sanskrit scholars before being applied.
                </p>
            </div>
        </div>
    );
}

export default SuggestionForm;
