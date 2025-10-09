import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './CommentaryManager.css';
import { useRef } from 'react'; // Add at top

function CommentaryManager({ theme }) {
    const { verseId } = useParams();
    const navigate = useNavigate();
    const [verse, setVerse] = useState(null);
    const [grantha, setGrantha] = useState(null);
    const [commentaries, setCommentaries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCommentary, setEditingCommentary] = useState(null);
    const [parentCommentary, setParentCommentary] = useState(null);
    const [loading, setLoading] = useState(true);
    const commentaryEditorRef = useRef(null);
    const [commentaryCursorPosition, setCommentaryCursorPosition] = useState(null);

    const [formData, setFormData] = useState({
        commentaryName: '',
        commentator: '',
        commentaryText: '',
        parentCommentaryId: null,
        level: 0
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
        if (commentaryEditorRef.current && commentaryCursorPosition !== null) {
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

                const { node, offset } = findTextNode(commentaryEditorRef.current, commentaryCursorPosition);
                range.setStart(node, offset);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                console.error('Cursor restoration failed:', e);
            }
        }
    }, [formData.commentaryText]);

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        if (!adminId) {
            navigate('/admin/login');
            return;
        }
        fetchData();
    }, [verseId, navigate]);

    useEffect(() => {
        if (commentaryEditorRef.current) {
            // Force browser to use <p> tags for Enter key
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
    }, []);

    const fetchData = async () => {
        try {
            console.log('Fetching data for verse:', verseId);

            const verseRes = await axios.get(`${config.API_URL}/api/verses/${verseId}`);
            const verse = verseRes.data;
            setVerse(verse);

            const granthaRes = await axios.get(`${config.API_URL}/api/granthas/${verse.granthaId}`);
            setGrantha(granthaRes.data);

            const commentariesRes = await axios.get(`${config.API_URL}/api/commentaries/verse/${verseId}`);
            console.log('Received commentaries:', commentariesRes.data);
            setCommentaries(commentariesRes.data);

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    };

    const handleEdit = (commentary) => {
        setEditingCommentary(commentary);
        setFormData({
            commentaryName: commentary.commentaryName,
            commentator: commentary.commentator || '',
            commentaryText: commentary.commentaryText,
            parentCommentaryId: commentary.parentCommentaryId,
            level: commentary.level
        });
        setShowForm(true);
    };

    const handleAddSubCommentary = (parentComment) => {
        console.log('Adding sub-commentary for:', parentComment);
        const parentLevel = parentComment.level !== undefined && parentComment.level !== null ? parentComment.level : 0;

        setParentCommentary(parentComment);
        setFormData({
            commentaryName: '',
            commentator: '',
            commentaryText: '',
            parentCommentaryId: parentComment._id,
            level: parentLevel + 1
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure? This will delete this commentary and all its sub-commentaries.')) {
            return;
        }

        try {
            await axios.delete(`${config.API_URL}/api/commentaries/${id}`);
            alert('✅ Commentary deleted successfully!');
            fetchData();
        } catch (error) {
            console.error('Failed to delete commentary:', error);
            alert('❌ Failed to delete commentary');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                verseId,
                granthaId: verse.granthaId
            };

            console.log('Submitting commentary:', payload);

            if (editingCommentary) {
                await axios.put(`${config.API_URL}/api/commentaries/${editingCommentary._id}`, payload);
                alert('✅ Commentary updated successfully!');
            } else {
                await axios.post(`${config.API_URL}/api/commentaries`, payload);
                alert('✅ Commentary created successfully!');
            }

            setShowForm(false);
            setEditingCommentary(null);
            setParentCommentary(null);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Failed to save commentary:', error);
            alert('❌ Failed to save commentary');
        }
    };

    const resetForm = () => {
        setFormData({
            commentaryName: '',
            commentator: '',
            commentaryText: '',
            parentCommentaryId: null,
            level: 0
        });
        setEditingCommentary(null);
        setParentCommentary(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        resetForm();
    };

    const handleCommentaryNameChange = (name) => {
        const commentaryDef = grantha.availableCommentaries?.find(c => c.name === name);
        setFormData({
            ...formData,
            commentaryName: name,
            commentator: commentaryDef?.author || ''
        });
    };

    const renderCommentary = (commentary, depth = 0) => {
        const indentClass = `indent-level-${Math.min(depth, 3)}`;
        const actualLevel = commentary.level !== undefined && commentary.level !== null ? commentary.level : depth;

        console.log('Rendering commentary:', {
            name: commentary.commentaryName,
            level: actualLevel,
            depth,
            hasSubCommentaries: !!commentary.subCommentaries,
            subCount: commentary.subCommentaries?.length || 0
        });

        return (
            <div key={commentary._id} className={`commentary-item ${indentClass}`}>
                <div className="commentary-card">
                    <div className="commentary-level-badge">
                        Level {actualLevel}
                    </div>
                    <div className="commentary-header">
                        <div>
                            <h3>{commentary.commentaryName}</h3>
                            {commentary.commentator && <p className="commentator">by {commentary.commentator}</p>}
                        </div>
                        <div className="commentary-actions">
                            <button className="btn-add-sub" onClick={() => handleAddSubCommentary(commentary)}>
                                ➕ Add Sub-Commentary
                            </button>
                            <button className="btn-edit" onClick={() => handleEdit(commentary)}>
                                ✏️ Edit
                            </button>
                            <button className="btn-delete" onClick={() => handleDelete(commentary._id)}>
                                🗑️ Delete
                            </button>
                        </div>
                    </div>

                    <div className="commentary-text">{commentary.commentaryText}</div>
                </div>

                {commentary.subCommentaries && commentary.subCommentaries.length > 0 && (
                    <div className="sub-commentaries">
                        {commentary.subCommentaries.map(subCom => renderCommentary(subCom, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="loading">Loading commentaries...</div>;

    if (!verse || !grantha) return <div className="error">Data not found</div>;

    return (
        <div className={`commentary-manager theme-${theme}`}>
        <div className="commentary-manager">
            <header className="manager-header">
                <div className="header-title">
                    <h1>Manage Commentaries</h1>
                    <p className="subtitle">{grantha.title}</p>
                    <p className="verse-info">
                        {grantha.chapterLabel || 'अध्यायः'} {verse.chapterNumber}, {grantha.verseLabel || 'श्लोकः'} {verse.verseNumber}
                    </p>
                </div>
                <div className="header-actions">
                    <Link to="/" className="btn-home-icon" title="Home">
                        🏠
                    </Link>
                    <button className="btn-back" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                    <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
                        ➕ Add Base Commentary
                    </button>
                </div>
            </header>

            <div className="verse-display">
                <div className="verse-text">{verse.verseText}</div>
            </div>

            {showForm && (
                <div className="commentary-form-container">
                    <div className="form-header">
                        <h2>
                            {editingCommentary
                                ? 'Edit Commentary'
                                : parentCommentary
                                    ? `Add Sub-Commentary (Level ${formData.level})`
                                    : 'Add Base Commentary'}
                        </h2>
                        <button className="btn-close" onClick={handleCancel}>×</button>
                    </div>

                    {parentCommentary && (
                        <div className="parent-commentary-info">
                            <h4>Parent Commentary:</h4>
                            <div className="parent-preview">
                                <strong>{parentCommentary.commentaryName}</strong>
                                {parentCommentary.commentator && <span> by {parentCommentary.commentator}</span>}
                                <div className="parent-level">Level {parentCommentary.level}</div>
                            </div>
                        </div>
                    )}

                    <form className="commentary-form" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Commentary Name *</label>
                                {grantha.availableCommentaries && grantha.availableCommentaries.length > 0 ? (
                                    <select
                                        value={formData.commentaryName}
                                        onChange={(e) => handleCommentaryNameChange(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Commentary</option>
                                        {grantha.availableCommentaries
                                            .sort((a, b) => a.order - b.order)
                                            .map((com, idx) => (
                                                <option key={idx} value={com.name}>
                                                    {com.name}
                                                </option>
                                            ))}
                                    </select>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={formData.commentaryName}
                                            onChange={(e) => setFormData({ ...formData, commentaryName: e.target.value })}
                                            placeholder="शाङ्करभाष्यम्"
                                            required
                                        />
                                        <small className="field-hint warning">
                                            ⚠️ No commentaries defined. Add in Grantha Manager first.
                                        </small>
                                    </>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Commentator</label>
                                <input
                                    type="text"
                                    value={formData.commentator}
                                    onChange={(e) => setFormData({ ...formData, commentator: e.target.value })}
                                    placeholder="आदि शङ्कराचार्यः"
                                    readOnly={grantha.availableCommentaries && grantha.availableCommentaries.length > 0}
                                />
                            </div>
                        </div>

                            <div className="form-group">
                                <label>Commentary Text *</label>
                                <div
                                    ref={commentaryEditorRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    className="formatted-textarea"
                                    dir="ltr"
                                    dangerouslySetInnerHTML={{ __html: formData.commentaryText }}
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

                                            setFormData({ ...formData, commentaryText: commentaryEditorRef.current.innerHTML });
                                        }
                                    }}
                                    onInput={(e) => {
                                        // Track cursor position
                                        const selection = window.getSelection();
                                        if (selection.rangeCount > 0) {
                                            const range = selection.getRangeAt(0);
                                            const preCaretRange = range.cloneRange();
                                            preCaretRange.selectNodeContents(commentaryEditorRef.current);
                                            preCaretRange.setEnd(range.endContainer, range.endOffset);
                                            const caretOffset = preCaretRange.toString().length;
                                            setCommentaryCursorPosition(caretOffset);
                                        }

                                        // Update form data
                                        setFormData({ ...formData, commentaryText: e.currentTarget.innerHTML });
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

                                        setFormData({ ...formData, commentaryText: commentaryEditorRef.current.innerHTML });
                                    }}
                                />
                            </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-save">
                                💾 {editingCommentary ? 'Update' : 'Save'} Commentary
                            </button>
                            <button type="button" className="btn-cancel" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="commentaries-list">
                <h2>All Commentaries ({commentaries.length})</h2>

                {commentaries.length === 0 ? (
                    <div className="no-commentaries">
                        No commentaries found. Add your first commentary!
                    </div>
                ) : (
                    <div className="commentaries-hierarchy">
                        {commentaries.map(commentary => renderCommentary(commentary, 0))}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}

export default CommentaryManager;
