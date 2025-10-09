import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './VerseManager.css';
import { useRef } from 'react'; // Add at top

function VerseManager({ theme }) {
    const { granthaId } = useParams();
    const navigate = useNavigate();
    const [grantha, setGrantha] = useState(null);
    const [verses, setVerses] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingVerse, setEditingVerse] = useState(null);
    const [loading, setLoading] = useState(true);
    const verseEditorRef = useRef(null);
    const [verseCursorPosition, setVerseCursorPosition] = useState(null);

    const [formData, setFormData] = useState({
        chapterNumber: 1,
        verseNumber: 1,
        verseText: ''
    });

    const sanitizeHTML = (html) => {
        let cleaned = html
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<xml[\s\S]*?<\/xml>/gi, '')
            .replace(/<meta[\s\S]*?>/gi, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\t/g, '&emsp;');

        const div = document.createElement('div');
        div.innerHTML = cleaned;

        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.cloneNode(true);
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }

            const tagName = node.tagName.toLowerCase();
            let newElement = null;

            // Handle formatting
            if (['b', 'strong'].includes(tagName) ||
                (node.style && (node.style.fontWeight === 'bold' || node.style.fontWeight === '700'))) {
                newElement = document.createElement('strong');
            } else if (['i', 'em'].includes(tagName) ||
                (node.style && node.style.fontStyle === 'italic')) {
                newElement = document.createElement('em');
            } else if (tagName === 'u' ||
                (node.style && node.style.textDecoration === 'underline')) {
                newElement = document.createElement('u');
            } else if (tagName === 'br') {
                return document.createElement('br');
            } else if (tagName === 'p' || tagName === 'div') {
                // Handle Word's <p> and <div> tags
                const p = document.createElement('p');
                Array.from(node.childNodes).forEach(child => {
                    const processed = processNode(child);
                    if (processed) p.appendChild(processed);
                });
                return p;
            }

            // Extract font-size, text-align, and font-family
            let fontSize = '';
            let textAlign = '';
            let fontFamily = '';

            if (node.style) {
                fontSize = node.style.fontSize;
                textAlign = node.style.textAlign;
                fontFamily = node.style.fontFamily;
            }

            // If we have any inline styles, use a span
            if (fontSize || textAlign || fontFamily) {
                const span = document.createElement('span');
                if (fontSize) span.style.fontSize = fontSize;
                if (textAlign) span.style.textAlign = textAlign;
                if (fontFamily) span.style.fontFamily = fontFamily;

                Array.from(node.childNodes).forEach(child => {
                    const processed = processNode(child);
                    if (processed) span.appendChild(processed);
                });

                return span;
            }

            // If we created a formatting element, process its children
            if (newElement) {
                Array.from(node.childNodes).forEach(child => {
                    const processed = processNode(child);
                    if (processed) newElement.appendChild(processed);
                });
                return newElement;
            }

            // Otherwise just process children
            const fragment = document.createDocumentFragment();
            Array.from(node.childNodes).forEach(child => {
                const processed = processNode(child);
                if (processed) fragment.appendChild(processed);
            });

            return fragment;
        };

        const result = document.createElement('div');
        Array.from(div.childNodes).forEach(child => {
            const processed = processNode(child);
            if (processed) result.appendChild(processed);
        });

        return result.innerHTML;
    };

    useEffect(() => {
        if (verseEditorRef.current && verseCursorPosition !== null) {
            try {
                const selection = window.getSelection();
                const range = document.createRange();

                const findTextNode = (node, offset) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (offset <= node.length) {
                            return { node, offset };
                        }
                        return { node, offset: node.length };
                    }

                    let currentOffset = 0;
                    for (let child of node.childNodes) {
                        const length = child.textContent.length;
                        if (currentOffset + length >= offset) {
                            return findTextNode(child, offset - currentOffset);
                        }
                        currentOffset += length;
                    }
                    return { node, offset: 0 };
                };

                const { node, offset } = findTextNode(verseEditorRef.current, verseCursorPosition);
                range.setStart(node, offset);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                console.error('Cursor restoration failed:', e);
            }
        }
    }, [formData.verseText]);

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        if (!adminId) {
            navigate('/admin/login');
            return;
        }
        fetchData();
    }, [granthaId, navigate]);

    useEffect(() => {
        if (verseEditorRef.current) {
            // Force browser to use <p> tags for Enter key
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
    }, []);

    const fetchData = async () => {
        try {
            const [granthaRes, versesRes] = await Promise.all([
                axios.get(`${config.API_URL}/api/granthas/${granthaId}`),
                axios.get(`${config.API_URL}/api/verses/grantha/${granthaId}`)
            ]);

            setGrantha(granthaRes.data);
            setVerses(versesRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    };

    const handleEdit = (verse) => {
        setEditingVerse(verse);
        setFormData({
            chapterNumber: verse.chapterNumber,
            verseNumber: verse.verseNumber,
            verseText: verse.verseText
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this verse? All associated commentaries will also be deleted.')) {
            return;
        }

        try {
            await axios.delete(`${config.API_URL}/api/verses/${id}`);
            alert('✅ Verse deleted successfully!');
            fetchData();
        } catch (error) {
            console.error('Failed to delete verse:', error);
            alert('❌ Failed to delete verse');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                granthaId
            };

            if (editingVerse) {
                await axios.put(`${config.API_URL}/api/verses/${editingVerse._id}`, payload);
                alert('✅ Verse updated successfully!');
            } else {
                await axios.post(`${config.API_URL}/api/verses`, payload);
                alert('✅ Verse created successfully!');
            }

            setShowForm(false);
            setEditingVerse(null);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Failed to save verse:', error);
            alert('❌ Failed to save verse');
        }
    };

    const resetForm = () => {
        let nextChapter = '1';
        let nextVerse = '1';

        if (verses.length > 0) {
            const sortedVerses = [...verses].sort((a, b) => {
                // Sort by chapter first, then verse
                if (String(a.chapterNumber) === String(b.chapterNumber)) {
                    return String(a.verseNumber).localeCompare(String(b.verseNumber), undefined, { numeric: true });
                }
                return String(a.chapterNumber).localeCompare(String(b.chapterNumber), undefined, { numeric: true });
            });

            const lastVerse = sortedVerses[sortedVerses.length - 1];
            nextChapter = String(lastVerse.chapterNumber);

            // Smart increment for verse number
            const lastVerseNum = String(lastVerse.verseNumber);
            const match = lastVerseNum.match(/^(\d+)([a-z]?)$/);

            if (match) {
                const num = parseInt(match[1]);
                const letter = match[2];

                if (letter) {
                    // Has letter suffix: 1a -> 1b
                    nextVerse = num + String.fromCharCode(letter.charCodeAt(0) + 1);
                } else {
                    // Plain number: 1 -> 2
                    nextVerse = String(num + 1);
                }
            } else {
                // Fallback
                nextVerse = '1';
            }
        }

        setFormData({
            chapterNumber: nextChapter,
            verseNumber: nextVerse,
            verseText: ''
        });
        setEditingVerse(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        resetForm();
    };

    const handleChapterChange = (chapterNum) => {
        // Only auto-calculate if NOT editing an existing verse
        if (!editingVerse) {
            const chapterVerses = verses.filter(v => String(v.chapterNumber) === String(chapterNum));
            let nextVerseNum = '1';

            if (chapterVerses.length > 0) {
                // Smart increment
                const lastVerse = chapterVerses[chapterVerses.length - 1];
                const lastVerseNum = String(lastVerse.verseNumber);
                const match = lastVerseNum.match(/^(\d+)([a-z]?)$/);

                if (match) {
                    const num = match[1];
                    const letter = match[2];

                    if (letter) {
                        // 1a -> 1b
                        nextVerseNum = num + String.fromCharCode(letter.charCodeAt(0) + 1);
                    } else {
                        // 1 -> 2
                        nextVerseNum = String(parseInt(num) + 1);
                    }
                } else {
                    nextVerseNum = String(chapterVerses.length + 1);
                }
            }

            setFormData({
                ...formData,
                chapterNumber: chapterNum,
                verseNumber: nextVerseNum
            });
        } else {
            // When editing, just update chapter, keep existing verse number
            setFormData({
                ...formData,
                chapterNumber: chapterNum
            });
        }
    };

    const versesByChapter = verses.reduce((acc, verse) => {
        if (!acc[verse.chapterNumber]) {
            acc[verse.chapterNumber] = [];
        }
        acc[verse.chapterNumber].push(verse);
        return acc;
    }, {});

    if (loading) return <div className="loading">Loading verses...</div>;

    if (!grantha) return <div className="error">Grantha not found</div>;

    return (
        <div className={`verse-manager theme-${theme}`}>
        <div className="verse-manager">
            <header className="manager-header">
                <div className="header-title">
                    <h1>Manage Verses</h1>
                    <p className="subtitle">{grantha.title}</p>
                </div>
                <div className="header-actions">
                    <Link to="/" className="btn-home-icon" title="Home">
                        🏠
                    </Link>
                    <button className="btn-back" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                    <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
                        ➕ Add Verse
                    </button>
                </div>
            </header>

            {showForm && (
                <div className="verse-form-container">
                    <div className="form-header">
                        <h2>{editingVerse ? 'Edit Verse' : 'Add New Verse'}</h2>
                        <button className="btn-close" onClick={handleCancel}>×</button>
                    </div>

                    <form className="verse-form" onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{grantha.chapterLabel} Number</label>
                                    <input
                                        type="text"
                                        value={formData.chapterNumber}
                                        onChange={(e) => handleChapterChange(e.target.value)}
                                        placeholder="Auto-incremented"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{grantha.verseLabel} Number</label>
                                    <input
                                        type="text"
                                        value={formData.verseNumber}
                                        onChange={(e) => setFormData({ ...formData, verseNumber: e.target.value })}
                                        placeholder="Auto-incremented"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Verse Text (Sanskrit) *</label>
                                <div
                                    ref={verseEditorRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    className="formatted-textarea"
                                    dir="ltr"
                                    dangerouslySetInnerHTML={{ __html: formData.verseText }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();

                                            if (e.shiftKey) {
                                                // Shift+Enter = Line break (simple <br>)
                                                document.execCommand('insertHTML', false, '<br>');
                                            } else {
                                                // Enter = Paragraph break (<p><br></p>)
                                                document.execCommand('insertHTML', false, '<p><br></p>');
                                            }

                                            setFormData({ ...formData, verseText: verseEditorRef.current.innerHTML });
                                        }
                                    }}
                                    onInput={(e) => {
                                        // Track cursor position
                                        const selection = window.getSelection();
                                        if (selection.rangeCount > 0) {
                                            const range = selection.getRangeAt(0);
                                            const preCaretRange = range.cloneRange();
                                            preCaretRange.selectNodeContents(verseEditorRef.current);
                                            preCaretRange.setEnd(range.endContainer, range.endOffset);
                                            const caretOffset = preCaretRange.toString().length;
                                            setVerseCursorPosition(caretOffset);
                                        }

                                        // Update form data
                                        setFormData({ ...formData, verseText: e.currentTarget.innerHTML });
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();

                                        const html = e.clipboardData.getData('text/html');
                                        const plainText = e.clipboardData.getData('text/plain');

                                        if (html) {
                                            let cleanedHTML = sanitizeHTML(html);
                                            document.execCommand('insertHTML', false, cleanedHTML);
                                        } else {
                                            document.execCommand('insertHTML', false, plainText);
                                        }

                                        setFormData({ ...formData, verseText: verseEditorRef.current.innerHTML });
                                    }}
                                />
                            </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-save">
                                💾 {editingVerse ? 'Update' : 'Save'} Verse
                            </button>
                            <button type="button" className="btn-cancel" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="verses-list">
                <h2>All Verses ({verses.length})</h2>

                {Object.keys(versesByChapter).length === 0 ? (
                    <div className="no-verses">
                        No verses found. Add your first verse!
                    </div>
                ) : (
                    Object.keys(versesByChapter).sort((a, b) => Number(a) - Number(b)).map(chapterNum => (
                        <div key={chapterNum} className="chapter-section">
                            <h3 className="chapter-title">
                                {grantha.chapterLabel || 'अध्यायः'} {chapterNum}
                                <span className="verse-count">({versesByChapter[chapterNum].length} verses)</span>
                            </h3>

                            <div className="verses-grid">
                                {versesByChapter[chapterNum]
                                    .sort((a, b) => a.verseNumber - b.verseNumber)
                                    .map(verse => (
                                        <div key={verse._id} className="verse-card">
                                            <div className="verse-header">
                                                <span className="verse-number">{grantha.verseLabel || 'श्लोकः'} {verse.verseNumber}</span>
                                                <div className="verse-actions">
                                                    <button className="btn-edit-small" onClick={() => handleEdit(verse)}>
                                                        ✏️
                                                    </button>
                                                    <button className="btn-delete-small" onClick={() => handleDelete(verse._id)}>
                                                        🗑️
                                                    </button>
                                                    <Link to={`/admin/commentaries/${verse._id}`} className="btn-commentaries">
                                                        💬 Commentaries
                                                    </Link>
                                                </div>
                                            </div>

                                            <div className="verse-text">{verse.verseText}</div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            </div>
        </div>
    );
}

export default VerseManager;
